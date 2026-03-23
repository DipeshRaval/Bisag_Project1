const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Mailjet = require('node-mailjet')
const bcrypt = require('bcryptjs')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')
require('dotenv').config()
const prisma = require('./lib/db')


const app = express()
const PORT = process.env.PORT || 3000
const allowedOrigins = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'http://localhost:4173',
	'http://127.0.0.1:4173', // Vite preview
	'http://localhost:3000',
	'http://127.0.0.1:3000',
]
const SESSION_COOKIE = 'drvl_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true })
}

const passwordResetStore = new Map()
const pendingSignupStore = new Map()
const allowedDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'zoho.com', 'icloud.com', 'proton.me', 'aol.com'])

const cookieOptions = {
	httpOnly: true,
	sameSite: 'lax',
	secure: process.env.NODE_ENV === 'production',
	path: '/',
}

const sanitizeUser = (user) => ({
	id: user.id,
	fullName: user.fullName,
	gender: user.gender,
	dob: user.dob,
	email: user.email,
	countryCode: user.countryCode,
	mobileNumber: user.mobileNumber,
	profileImagePath: user.profileImagePath,
	documentPath: user.documentPath,
	isActive: user.isActive,
	lastLogin: user.lastLogin,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
})

const createSession = async (res, userId) => {
	const token = crypto.randomBytes(32).toString('hex')
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
	await prisma.session.create({
		data: {
			token,
			userId,
			expiresAt,
		},
	})
	res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS })
}

const revokeUserSessions = async (userId) => {
	if (!userId) return
	await prisma.session.deleteMany({ where: { userId } })
}

const safeDeleteUpload = async (filename) => {
	if (!filename) return
	const filePath = path.join(uploadDir, filename)
	try {
		await fs.promises.unlink(filePath)
	} catch (err) {
		if (err?.code !== 'ENOENT') {
			console.warn('[UPLOAD DELETE WARNING]', err.message)
		}
	}
}

const safeDeleteUploads = async (filenames = []) => {
	await Promise.all((filenames || []).filter(Boolean).map((name) => safeDeleteUpload(name)))
}

const deleteSessionByToken = async (token) => {
	if (!token) return
	await prisma.session.deleteMany({ where: { token } })
}

const getSessionFromRequest = async (req) => {
	const token = req.cookies?.[SESSION_COOKIE]
	if (!token) return null
	const session = await prisma.session.findUnique({
		where: { token },
		include: { user: true },
	})
	if (!session) return null
	if (session.expiresAt < new Date()) {
		await deleteSessionByToken(token)
		return null
	}
	if (!session.user?.isActive) {
		await deleteSessionByToken(token)
		return null
	}
	return session
}

const clearSession = async (req, res) => {
	const token = req.cookies?.[SESSION_COOKIE]
	if (token) {
		await deleteSessionByToken(token)
	}
	res.clearCookie(SESSION_COOKIE, cookieOptions)
}

const requireAuth = async (req, res, next) => {
	try {
		const session = await getSessionFromRequest(req)
		if (!session) {
			await clearSession(req, res)
			return res.status(401).json({ message: 'Not authenticated' })
		}
		req.session = session
		req.currentUser = session.user
		return next()
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Authentication failed' })
	}
}

const isValidEmail = (email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ''))

const validateStrongPassword = (password) => {
	if (!password || password.length < 8) return 'Password must be at least 8 characters'
	if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter'
	if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter'
	if (!/\d/.test(password)) return 'Password needs a number'
	if (!/[^A-Za-z0-9]/.test(password)) return 'Password needs a special character'
	if (/(123|abc|password|qwerty)/i.test(password)) return 'Password is too common'
	return ''
}

const hashOtp = (email, otp) => crypto.createHash('sha256').update(`${String(email).toLowerCase()}:${otp}`).digest('hex')

const buildOtpEmailTemplate = ({ otp, purpose = 'reset', brandName = 'DRVL', appUrl = '' }) => {
	const isSignup = purpose === 'signup'
	const title = isSignup ? 'Verify Your Email' : 'Reset Your Password'
	const subtitle = isSignup
		? 'Use this OTP to verify your email and activate your new account.'
		: 'Use this OTP to reset your password securely.'
	const supportText = appUrl
		? `If you did not request this, please ignore this email or visit ${appUrl}.`
		: 'If you did not request this, please ignore this email.'

	const subject = isSignup ? `${brandName} signup verification OTP` : `${brandName} password reset OTP`
	const text = [
		title,
		`Your OTP is: ${otp}`,
		'It expires in 10 minutes.',
		supportText,
	].join('\n')

	const html = `
<div style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="background:linear-gradient(90deg,#0ea5e9,#2563eb);padding:20px 24px;color:#ffffff;">
        <div style="font-size:20px;font-weight:700;">${brandName}</div>
        <div style="font-size:13px;opacity:0.95;margin-top:4px;">Secure One-Time Password</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px;">
        <h2 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h2>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">${subtitle}</p>
        <div style="text-align:center;margin:0 0 20px 0;">
          <div style="display:inline-block;padding:14px 22px;border:1px dashed #93c5fd;border-radius:10px;background:#eff6ff;">
            <span style="font-size:30px;letter-spacing:6px;font-weight:700;color:#1d4ed8;">${otp}</span>
          </div>
        </div>
        <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">This OTP will expire in <strong>10 minutes</strong>.</p>
        <p style="margin:0;font-size:13px;color:#64748b;">${supportText}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#64748b;">
        This is a transactional message from ${brandName}. Please do not reply to this email.
      </td>
    </tr>
  </table>
</div>`.trim()

	return { subject, text, html }
}

const sendPasswordResetOtpEmail = async (email, otp, purpose = 'reset') => {
	const {
		MAILJET_API_KEY,
		MAILJET_API_SECRET,
		MAILJET_FROM_EMAIL,
		MAILJET_FROM_NAME,
		MAIL_REPLY_TO,
		MAIL_BRAND_NAME,
		APP_URL,
		MAILJET_TEST_MODE,
		MAILJET_TEST_EMAIL,
		MAIL_OTP_DEBUG,
	} = process.env

	if (!MAILJET_API_KEY || !MAILJET_API_SECRET || !MAILJET_FROM_EMAIL) {
		throw new Error('Mailjet is not configured. Set MAILJET_API_KEY, MAILJET_API_SECRET and MAILJET_FROM_EMAIL')
	}

	const isTestMode = String(MAILJET_TEST_MODE || '').toLowerCase() === 'true'
	const targetEmail = isTestMode && MAILJET_TEST_EMAIL ? MAILJET_TEST_EMAIL : email
	const testNotice = isTestMode && targetEmail !== email ? `<p><strong>Intended recipient:</strong> ${email}</p>` : ''
	const debugEnabled = String(MAIL_OTP_DEBUG || '').toLowerCase() === 'true'
	const brandName = MAIL_BRAND_NAME || MAILJET_FROM_NAME || 'DRVL'
	const template = buildOtpEmailTemplate({ otp, purpose, brandName, appUrl: APP_URL || '' })

	if (debugEnabled) {
		console.log('[OTP DEBUG] Mail attempt started', {
			fromEmail: MAILJET_FROM_EMAIL,
			fromName: MAILJET_FROM_NAME || 'DRVL',
			inputEmail: email,
			targetEmail,
			isTestMode,
			purpose,
			otp,
			timestamp: new Date().toISOString(),
		})
	}

	const payload = {
		Messages: [
			{
				From: {
					Email: MAILJET_FROM_EMAIL,
					Name: MAILJET_FROM_NAME || brandName,
				},
				To: [{ Email: targetEmail }],
				ReplyTo: {
					Email: MAIL_REPLY_TO || MAILJET_FROM_EMAIL,
					Name: brandName,
				},
				Subject: template.subject,
				TextPart: template.text,
				HTMLPart: `${testNotice}${template.html}`,
				CustomID: `${purpose}-otp-${Date.now()}`,
				Headers: {
					'X-OTP-Purpose': purpose,
					'X-Entity-Ref-ID': `${purpose}-${Date.now()}`,
				},
			},
		],
	}

	const mailjet = Mailjet.apiConnect(MAILJET_API_KEY, MAILJET_API_SECRET)
	try {
		const result = await mailjet.post('send', { version: 'v3.1' }).request(payload)
		const messageResult = result?.body?.Messages?.[0] || {}
		const deliveryStatus = String(messageResult?.Status || '').toLowerCase()
		const toList = Array.isArray(messageResult?.To) ? messageResult.To : []
		const errorList = Array.isArray(messageResult?.Errors) ? messageResult.Errors : []

		if (debugEnabled) {
			console.log('[OTP DEBUG] Mailjet success response', {
				statusCode: result?.response?.status,
				deliveryStatus: messageResult?.Status,
				messageId: messageResult?.To?.[0]?.MessageID,
				messageUUID: messageResult?.To?.[0]?.MessageUUID,
				to: toList,
				errors: errorList,
				body: result?.body,
			})
		}

		if (deliveryStatus !== 'success') {
			throw new Error(`Mailjet message rejected: ${JSON.stringify({ status: messageResult?.Status, errors: errorList })}`)
		}

		return { targetEmail, isTestMode, providerResponse: result?.body }
	} catch (err) {
		const statusCode = err?.statusCode || err?.response?.status || 500
		const body = err?.response?.data || err?.message || 'Unknown error'
		console.error('[OTP DEBUG] Mailjet send failed', {
			statusCode,
			inputEmail: email,
			targetEmail,
			isTestMode,
			otp,
			errorBody: body,
		})
		throw new Error(`Mailjet request failed (${statusCode}): ${typeof body === 'string' ? body : JSON.stringify(body)}`)
	}
}

const findUserByEmailInsensitive = (email) => prisma.user.findFirst({
	where: {
		email: {
			equals: email,
			mode: 'insensitive',
		},
	},
})

const storage = multer.diskStorage({
	destination: (_, __, cb) => cb(null, uploadDir),
	filename: (_, file, cb) => {
		const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')
		cb(null, `${Date.now()}-${safeName}`)
	},
})

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB cap (profile image further checked below)
	},
	fileFilter: (req, file, cb) => {
		if (file.fieldname === 'profileImage') {
			return /image\/(jpeg|jpg)/.test(file.mimetype) ? cb(null, true) : cb(new Error('Profile image must be JPG/JPEG'))
		}
		if (file.fieldname === 'document') {
			const okDocs = [
				'application/pdf',
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			]
			return okDocs.includes(file.mimetype) ? cb(null, true) : cb(new Error('Document must be PDF or DOC/DOCX'))
		}
		return cb(new Error('Unexpected field'))
	},
})

const corsOptions = {
	origin: (origin, cb) => {
		if (!origin) return cb(null, true)
		return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))
	},
	optionsSuccessStatus: 200,
	credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(uploadDir))

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' })
})

app.get('/api/session', async (req, res) => {
	try {
		const session = await getSessionFromRequest(req)
		if (!session) {
			await clearSession(req, res)
			return res.status(401).json({ message: 'Not authenticated' })
		}
		return res.json({ user: sanitizeUser(session.user) })
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to fetch session' })
	}
})

app.post('/api/signout', async (req, res) => {
	await clearSession(req, res)
	return res.json({ message: 'Signed out' })
})

app.get('/api/users', requireAuth, async (_req, res) => {
	try {
		const users = await prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
		})
		return res.json({ users: users.map(sanitizeUser) })
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to load users' })
	}
})

app.patch('/api/users/:id/status', requireAuth, async (req, res) => {
	try {
		const { id } = req.params
		const { isActive } = req.body || {}

		if (typeof isActive !== 'boolean') {
			return res.status(400).json({ message: 'isActive boolean is required' })
		}

		if (req.currentUser?.id === id && !isActive) {
			return res.status(400).json({ message: 'You cannot disable your own account' })
		}

		const updatedUser = await prisma.user.update({
			where: { id },
			data: { isActive },
		})

		if (!isActive) {
			await revokeUserSessions(id)
		}

		return res.json({ message: 'User status updated', user: sanitizeUser(updatedUser) })
	} catch (err) {
		if (err?.code === 'P2025') {
			return res.status(404).json({ message: 'User not found' })
		}
		return res.status(500).json({ message: err.message || 'Failed to update status' })
	}
})

app.patch(
	'/api/users/:id',
	requireAuth,
	upload.fields([
		{ name: 'profileImage', maxCount: 1 },
		{ name: 'document', maxCount: 1 },
	]),
	async (req, res) => {
	try {
		const { id } = req.params
		const existingUser = await prisma.user.findUnique({ where: { id } })
		const profileFile = req.files?.profileImage?.[0]
		const docFile = req.files?.document?.[0]

		if (!existingUser) {
			await safeDeleteUploads([profileFile?.filename, docFile?.filename])
			return res.status(404).json({ message: 'User not found' })
		}

		const {
			fullName,
			gender,
			dob,
			email,
			password,
			confirmPassword,
			countryCode,
			mobileNumber,
			isActive,
		} = req.body || {}

		const data = {}

		if (fullName !== undefined) {
			if (!fullName.trim()) return res.status(400).json({ message: 'Full name cannot be empty' })
			if (!/^[A-Za-z ]+$/.test(fullName)) return res.status(400).json({ message: 'Only letters and spaces allowed in name' })
			data.fullName = fullName.trim()
		}

		if (gender !== undefined) {
			const allowedGender = new Set(['male', 'female', 'other'])
			const normalizedGender = String(gender || '').trim().toLowerCase()
			if (normalizedGender && !allowedGender.has(normalizedGender)) return res.status(400).json({ message: 'Invalid gender value' })
			data.gender = normalizedGender
		}

		if (dob !== undefined) {
			if (!dob) return res.status(400).json({ message: 'Date of birth cannot be empty' })
			const parsedDob = new Date(dob)
			if (Number.isNaN(parsedDob.getTime())) return res.status(400).json({ message: 'Invalid date of birth' })
			data.dob = parsedDob
		}

		if (email !== undefined) {
			const normalizedEmail = String(email || '').trim().toLowerCase()
			if (!normalizedEmail) return res.status(400).json({ message: 'Email is required' })
			if (!isValidEmail(normalizedEmail)) return res.status(400).json({ message: 'Email is invalid' })
			const domain = normalizedEmail.split('@')[1]?.toLowerCase()
			if (!domain || !allowedDomains.has(domain)) {
				return res.status(400).json({ message: 'Use a popular email domain (gmail.com, yahoo.com, outlook.com, hotmail.com, zoho.com, icloud.com, proton.me, aol.com)' })
			}

			if (normalizedEmail !== existingUser.email.toLowerCase()) {
				const emailOwner = await findUserByEmailInsensitive(normalizedEmail)
				if (emailOwner && emailOwner.id !== id) {
					return res.status(409).json({ message: 'Email is already registered' })
				}
			}

			data.email = normalizedEmail
		}

		if (password !== undefined || confirmPassword !== undefined) {
			const normalizedPassword = String(password || '')
			const normalizedConfirmPassword = String(confirmPassword || '')

			if (!normalizedPassword) {
				return res.status(400).json({ message: 'Password is required' })
			}

			const passwordError = validateStrongPassword(normalizedPassword)
			if (passwordError) {
				return res.status(400).json({ message: passwordError })
			}

			if (normalizedPassword !== normalizedConfirmPassword) {
				return res.status(400).json({ message: 'Passwords do not match' })
			}

			data.passwordHash = await bcrypt.hash(normalizedPassword, 10)
		}

		if (countryCode !== undefined) {
			if (!countryCode.trim()) return res.status(400).json({ message: 'Country code cannot be empty' })
			data.countryCode = countryCode.trim()
		}

		if (mobileNumber !== undefined) {
			if (!mobileNumber.trim()) return res.status(400).json({ message: 'Mobile number cannot be empty' })
			data.mobileNumber = mobileNumber.trim()
		}

		if (isActive !== undefined) {
			let normalizedIsActive = isActive
			if (typeof normalizedIsActive === 'string') {
				normalizedIsActive = normalizedIsActive.toLowerCase() === 'true'
			}
			if (typeof normalizedIsActive !== 'boolean') return res.status(400).json({ message: 'isActive must be true or false' })
			if (req.currentUser?.id === id && !normalizedIsActive) {
				return res.status(400).json({ message: 'You cannot disable your own account' })
			}
			data.isActive = normalizedIsActive
		}

		if (profileFile && profileFile.size > 1 * 1024 * 1024) {
			await safeDeleteUploads([profileFile.filename, docFile?.filename])
			return res.status(400).json({ message: 'Profile image exceeds 1MB' })
		}

		if (docFile && docFile.size > 5 * 1024 * 1024) {
			await safeDeleteUploads([profileFile?.filename, docFile.filename])
			return res.status(400).json({ message: 'Document exceeds 5MB' })
		}

		if (profileFile?.filename) {
			data.profileImagePath = profileFile.filename
		}

		if (docFile?.filename) {
			data.documentPath = docFile.filename
		}

		if (!Object.keys(data).length) {
			await safeDeleteUploads([profileFile?.filename, docFile?.filename])
			return res.status(400).json({ message: 'No editable fields provided' })
		}

		const user = await prisma.user.update({
			where: { id },
			data,
		})

		if (data.isActive === false) {
			await revokeUserSessions(id)
		}

		if (data.passwordHash) {
			await revokeUserSessions(id)
		}

		if (data.profileImagePath && existingUser.profileImagePath && existingUser.profileImagePath !== data.profileImagePath) {
			await safeDeleteUpload(existingUser.profileImagePath)
		}

		if (data.documentPath && existingUser.documentPath && existingUser.documentPath !== data.documentPath) {
			await safeDeleteUpload(existingUser.documentPath)
		}

		return res.json({ message: 'User updated', user: sanitizeUser(user) })
	} catch (err) {
		const profileFile = req.files?.profileImage?.[0]
		const docFile = req.files?.document?.[0]
		await safeDeleteUploads([profileFile?.filename, docFile?.filename])
		if (err?.code === 'P2025') {
			return res.status(404).json({ message: 'User not found' })
		}
		if (err?.code === 'P2002') {
			return res.status(409).json({ message: 'Email is already registered' })
		}
		return res.status(500).json({ message: err.message || 'Failed to update user' })
	}
})

app.delete('/api/users/:id', requireAuth, async (req, res) => {
	try {
		const { id } = req.params

		if (req.currentUser?.id === id) {
			return res.status(400).json({ message: 'You cannot delete your own account' })
		}

		const user = await prisma.user.findUnique({ where: { id } })
		if (!user) {
			return res.status(404).json({ message: 'User not found' })
		}

		await prisma.$transaction([
			prisma.session.deleteMany({ where: { userId: id } }),
			prisma.user.delete({ where: { id } }),
		])

		await Promise.all([
			safeDeleteUpload(user.profileImagePath),
			safeDeleteUpload(user.documentPath),
		])

		return res.json({ message: 'User deleted successfully' })
	} catch (err) {
		if (err?.code === 'P2025') {
			return res.status(404).json({ message: 'User not found' })
		}
		return res.status(500).json({ message: err.message || 'Failed to delete user' })
	}
})

app.post('/api/password/forgot', async (req, res) => {
	try {
		const { email = '' } = req.body || {}
		const normalizedEmail = String(email).trim().toLowerCase()

		if (!isValidEmail(normalizedEmail)) {
			return res.status(400).json({ message: 'Valid email is required' })
		}
		const domain = normalizedEmail.split('@')[1]?.toLowerCase()
		if (!domain || !allowedDomains.has(domain)) {
			return res.status(400).json({ message: 'Use a popular email domain (gmail.com, yahoo.com, outlook.com, hotmail.com, zoho.com, icloud.com, proton.me, aol.com)' })
		}

		const user = await findUserByEmailInsensitive(normalizedEmail)
		if (!user) {
			return res.status(404).json({ message: 'Email is not registered' })
		}

		const existing = passwordResetStore.get(normalizedEmail)
		if (existing?.lastSentAt && Date.now() - existing.lastSentAt < 30 * 1000) {
			return res.status(429).json({ message: 'Please wait before requesting another OTP' })
		}

		const otp = String(Math.floor(100000 + Math.random() * 900000))
		const mailInfo = await sendPasswordResetOtpEmail(normalizedEmail, otp, 'reset')

		passwordResetStore.set(normalizedEmail, {
			otpHash: hashOtp(normalizedEmail, otp),
			expiresAt: Date.now() + 10 * 60 * 1000,
			verifiedUntil: 0,
			attempts: 0,
			lastSentAt: Date.now(),
		})

		return res.json({
			message: mailInfo?.isTestMode && mailInfo?.targetEmail
				? `OTP sent to test mailbox: ${mailInfo.targetEmail}`
				: 'OTP sent to your email',
			routedTo: mailInfo?.targetEmail || normalizedEmail,
			testMode: Boolean(mailInfo?.isTestMode),
		})
	} catch (err) {
		console.error('[OTP DEBUG] /api/password/forgot failed', err)
		return res.status(500).json({ message: err.message || 'Failed to send OTP' })
	}
})

app.post('/api/password/verify-otp', async (req, res) => {
	try {
		const { email = '', otp = '' } = req.body || {}
		const normalizedEmail = String(email).trim().toLowerCase()
		const normalizedOtp = String(otp).trim()
		if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(normalizedOtp)) {
			return res.status(400).json({ message: 'Valid email and 6-digit OTP are required' })
		}

		const entry = passwordResetStore.get(normalizedEmail)
		if (!entry) {
			return res.status(400).json({ message: 'OTP not found. Request a new OTP' })
		}
		if (Date.now() > entry.expiresAt) {
			passwordResetStore.delete(normalizedEmail)
			return res.status(400).json({ message: 'OTP expired. Request a new OTP' })
		}

		if (entry.attempts >= 5) {
			passwordResetStore.delete(normalizedEmail)
			return res.status(429).json({ message: 'Too many invalid attempts. Request a new OTP' })
		}

		if (entry.otpHash !== hashOtp(normalizedEmail, normalizedOtp)) {
			entry.attempts += 1
			passwordResetStore.set(normalizedEmail, entry)
			return res.status(400).json({ message: 'Invalid OTP' })
		}

		entry.verifiedUntil = Date.now() + 10 * 60 * 1000
		entry.attempts = 0
		passwordResetStore.set(normalizedEmail, entry)
		return res.json({ message: 'OTP verified. You can now set a new password' })
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to verify OTP' })
	}
})

app.post('/api/password/reset', async (req, res) => {
	try {
		const { email = '', password = '', confirmPassword = '' } = req.body || {}
		const normalizedEmail = String(email).trim().toLowerCase()

		if (!isValidEmail(normalizedEmail)) {
			return res.status(400).json({ message: 'Valid email is required' })
		}
		const passwordError = validateStrongPassword(password)
		if (passwordError) {
			return res.status(400).json({ message: passwordError })
		}
		if (password !== confirmPassword) {
			return res.status(400).json({ message: 'Passwords do not match' })
		}

		const entry = passwordResetStore.get(normalizedEmail)
		if (!entry || !entry.verifiedUntil || Date.now() > entry.verifiedUntil) {
			return res.status(400).json({ message: 'OTP verification is required before password reset' })
		}

		const user = await findUserByEmailInsensitive(normalizedEmail)
		if (!user) {
			passwordResetStore.delete(normalizedEmail)
			return res.status(404).json({ message: 'Email is not registered' })
		}

		const passwordHash = await bcrypt.hash(password, 10)
		await prisma.user.update({
			where: { id: user.id },
			data: { passwordHash, updatedAt: new Date() },
		})

		await revokeUserSessions(user.id)
		passwordResetStore.delete(normalizedEmail)
		return res.json({ message: 'Password updated successfully. Please sign in.' })
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to reset password' })
	}
})

app.post(
	'/api/signup',
	upload.fields([
		{ name: 'profileImage', maxCount: 1 },
		{ name: 'document', maxCount: 1 },
	]),
	async (req, res) => {
		try {
			const {
				fullName = '',
				gender = '',
				dob = '',
				email = '',
				password = '',
				confirmPassword = '',
				countryCode = '',
				mobileNumber = '',
			} = req.body

			const errors = []
			if (!fullName.trim()) errors.push('Full name is required')
			if (fullName && !/^[A-Za-z ]+$/.test(fullName)) errors.push('Only letters and spaces allowed in name')
			if (!gender) errors.push('Gender is required')
			if (!dob) errors.push('Date of birth is required')
			if (!email) errors.push('Email is required')
			if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Email is invalid')

			const domain = email.split('@')[1]?.toLowerCase()
			if (email && domain && !allowedDomains.has(domain)) errors.push('Use a popular email domain (gmail.com, yahoo.com, outlook.com, hotmail.com, zoho.com, icloud.com, proton.me, aol.com)')

			if (!password || password.length < 8) errors.push('Password must be at least 8 characters')
			if (password && !/[A-Z]/.test(password)) errors.push('Password needs an uppercase letter')
			if (password && !/[a-z]/.test(password)) errors.push('Password needs a lowercase letter')
			if (password && !/\d/.test(password)) errors.push('Password needs a number')
			if (password && !/[^A-Za-z0-9]/.test(password)) errors.push('Password needs a special character')
			if (password && /(123|abc|password|qwerty)/i.test(password)) errors.push('Password is too common')
			if (password !== confirmPassword) errors.push('Passwords do not match')
			if (!mobileNumber) errors.push('Mobile number is required')
			if (!req.files || !req.files.profileImage) errors.push('Profile image is required')
			if (!req.files || !req.files.document) errors.push('Document is required')

			const profileFile = req.files?.profileImage?.[0]
			const docFile = req.files?.document?.[0]

			if (profileFile && profileFile.size > 1 * 1024 * 1024) {
				errors.push('Profile image exceeds 1MB')
			}

			if (docFile && docFile.size > 5 * 1024 * 1024) {
				errors.push('Document exceeds 5MB')
			}

			if (errors.length) {
				await safeDeleteUploads([profileFile?.filename, docFile?.filename])
				return res.status(400).json({ message: errors.join(', ') })
			}

			const normalizedEmail = String(email).trim().toLowerCase()
			const existingUser = await findUserByEmailInsensitive(normalizedEmail)
			if (existingUser) {
				await safeDeleteUploads([profileFile?.filename, docFile?.filename])
				return res.status(409).json({ message: 'Email is already registered' })
			}

			for (const [token, pending] of pendingSignupStore.entries()) {
				if (pending?.email === normalizedEmail) {
					await safeDeleteUploads([pending.profileImagePath, pending.documentPath])
					pendingSignupStore.delete(token)
				}
			}

			const signupToken = crypto.randomBytes(24).toString('hex')
			const signupOtp = String(Math.floor(100000 + Math.random() * 900000))
			await sendPasswordResetOtpEmail(normalizedEmail, signupOtp, 'signup')

			pendingSignupStore.set(signupToken, {
				email: normalizedEmail,
				otpHash: hashOtp(normalizedEmail, signupOtp),
				expiresAt: Date.now() + 10 * 60 * 1000,
				attempts: 0,
				fullName: fullName.trim(),
				gender,
				dob,
				password,
				countryCode,
				mobileNumber,
				profileImagePath: profileFile?.filename || '',
				documentPath: docFile?.filename || '',
			})

			return res.json({
				message: 'Signup OTP sent to your email',
				requiresOtp: true,
				signupToken,
			})
		} catch (err) {
			console.error('[SIGNUP ERROR]', err)
			if (err?.code === 'P2002') {
				const profileFile = req.files?.profileImage?.[0]
				const docFile = req.files?.document?.[0]
				await safeDeleteUploads([profileFile?.filename, docFile?.filename])
				return res.status(409).json({ message: 'Email is already registered' })
			}
			const profileFile = req.files?.profileImage?.[0]
			const docFile = req.files?.document?.[0]
			await safeDeleteUploads([profileFile?.filename, docFile?.filename])
			return res.status(500).json({ message: err.message || 'Server error' })
		}
	},
)

app.post('/api/signup/verify-otp', async (req, res) => {
	try {
		const { signupToken = '', otp = '' } = req.body || {}
		const normalizedToken = String(signupToken).trim()
		const normalizedOtp = String(otp).trim()

		if (!normalizedToken || !/^\d{6}$/.test(normalizedOtp)) {
			return res.status(400).json({ message: 'Signup token and 6-digit OTP are required' })
		}

		const pending = pendingSignupStore.get(normalizedToken)
		if (!pending) {
			return res.status(400).json({ message: 'Signup OTP session not found. Please sign up again.' })
		}

		if (Date.now() > pending.expiresAt) {
			await safeDeleteUploads([pending.profileImagePath, pending.documentPath])
			pendingSignupStore.delete(normalizedToken)
			return res.status(400).json({ message: 'Signup OTP expired. Please sign up again.' })
		}

		if (pending.attempts >= 5) {
			await safeDeleteUploads([pending.profileImagePath, pending.documentPath])
			pendingSignupStore.delete(normalizedToken)
			return res.status(429).json({ message: 'Too many invalid attempts. Please sign up again.' })
		}

		if (pending.otpHash !== hashOtp(pending.email, normalizedOtp)) {
			pending.attempts += 1
			pendingSignupStore.set(normalizedToken, pending)
			return res.status(400).json({ message: 'Invalid signup OTP' })
		}

		const existingUser = await findUserByEmailInsensitive(pending.email)
		if (existingUser) {
			await safeDeleteUploads([pending.profileImagePath, pending.documentPath])
			pendingSignupStore.delete(normalizedToken)
			return res.status(409).json({ message: 'Email is already registered' })
		}

		const passwordHash = await bcrypt.hash(pending.password, 10)
		const dobDate = new Date(pending.dob)
		const now = new Date()
		const user = await prisma.user.create({
			data: {
				fullName: pending.fullName,
				gender: pending.gender,
				dob: dobDate,
				email: pending.email,
				passwordHash,
				countryCode: pending.countryCode,
				mobileNumber: pending.mobileNumber,
				profileImagePath: pending.profileImagePath,
				documentPath: pending.documentPath,
				lastLogin: now,
			},
		})

		await revokeUserSessions(user.id)
		await createSession(res, user.id)
		pendingSignupStore.delete(normalizedToken)

		return res.json({
			message: 'Signup verified successfully',
			user: sanitizeUser(user),
		})
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to verify signup OTP' })
	}
})

app.post('/api/signin', async (req, res) => {
	try {
		const { email = '', password = '' } = req.body || {}
		const normalizedEmail = String(email).trim().toLowerCase()
		if (!normalizedEmail || !password) {
			return res.status(400).json({ message: 'Email and password are required' })
		}
		const user = await findUserByEmailInsensitive(normalizedEmail)
		if (!user) {
			return res.status(401).json({ message: 'Invalid credentials' })
		}
		if (!user.isActive) {
			return res.status(403).json({ message: 'Account is inactive. Contact support.' })
		}
		const valid = await bcrypt.compare(password, user.passwordHash)
		if (!valid) {
			return res.status(401).json({ message: 'Invalid credentials' })
		}
		const loginTime = new Date()
		const updatedUser = await prisma.user.update({
			where: { id: user.id },
			data: { lastLogin: loginTime },
		})
		await revokeUserSessions(user.id)
		await createSession(res, user.id)
		return res.json({ message: 'Signed in', user: sanitizeUser(updatedUser) })
	} catch (err) {
		console.error('[SIGNIN ERROR]', err)
		return res.status(500).json({ message: err.message || 'Failed to sign in' })
	}
})

app.listen(PORT, () => {
	console.log(`API listening on port ${PORT}`)
})
