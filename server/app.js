const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
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

/* OTP flow temporarily disabled
const otpStore = new Map()
*/
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

/* OTP flow temporarily disabled
const sendOtpEmail = async (email, otp) => {
	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

	console.log('Drvl SMTP Config:', { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM }) // Don't log the password

	if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
		throw new Error('SMTP environment variables are not set')
	}

	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS,
		},
	})

	transporter.verify((err, success) => {
		if (err) {
			console.log(err)
		} else {
			console.log('Server ready')
		}
	})

	console.log(`[OTP] Sending to ${email}: ${otp}`)

	await transporter.sendMail({
		from: SMTP_FROM,
		to: email,
		subject: 'Your verification code',
		text: `Your verification code is ${otp}. It expires in 10 minutes.`,
		html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
	})
}
*/

/* OTP routes temporarily disabled
app.post('/api/otp/send', async (req, res) => {
	try {
		const { email } = req.body || {}
		if (!email) return res.status(400).json({ message: 'Email is required' })
		const domain = email.split('@')[1]?.toLowerCase()
		if (!domain || !allowedDomains.has(domain)) {
			return res.status(400).json({ message: 'Use a popular email domain (gmail.com, yahoo.com, outlook.com, hotmail.com, zoho.com, icloud.com, proton.me, aol.com)' })
		}
		const otp = Math.floor(100000 + Math.random() * 900000).toString()
		const expires = Date.now() + 10 * 60 * 1000
		otpStore.set(email, { otp, expires })
		await sendOtpEmail(email, otp)
		return res.json({ message: 'OTP sent' })
	} catch (err) {
		return res.status(500).json({ message: err.message || 'Failed to send OTP' })
	}
})

app.post('/api/otp/verify', (req, res) => {
	const { email, otp } = req.body || {}
	if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' })
	const entry = otpStore.get(email)
	if (!entry) return res.status(400).json({ message: 'OTP not found or expired' })
	if (Date.now() > entry.expires) {
		otpStore.delete(email)
		return res.status(400).json({ message: 'OTP expired' })
	}
	if (entry.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' })
	otpStore.delete(email)
	return res.json({ message: 'OTP verified' })
})
*/

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
				return res.status(400).json({ message: errors.join(', ') })
			}

			const passwordHash = await bcrypt.hash(password, 10)
			const dobDate = new Date(dob)
			const now = new Date()
			const user = await prisma.user.create({
				data: {
					fullName,
					gender,
					dob: dobDate,
					email,
					passwordHash,
					countryCode,
					mobileNumber,
					profileImagePath: profileFile?.filename || '',
					documentPath: docFile?.filename || '',
					lastLogin: now,
				},
			})

			await revokeUserSessions(user.id)
			await createSession(res, user.id)

			return res.json({
				message: 'Signup received',
				user: sanitizeUser(user),
			})
		} catch (err) {
			console.error('[SIGNUP ERROR]', err)
			if (err?.code === 'P2002') {
				return res.status(409).json({ message: 'Email is already registered' })
			}
			return res.status(500).json({ message: err.message || 'Server error' })
		}
	},
)

app.post('/api/signin', async (req, res) => {
	try {
		const { email = '', password = '' } = req.body || {}
		if (!email || !password) {
			return res.status(400).json({ message: 'Email and password are required' })
		}
		const user = await prisma.user.findUnique({ where: { email } })
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
