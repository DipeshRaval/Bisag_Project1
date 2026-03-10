require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
	throw new Error('DATABASE_URL is not defined')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({
	adapter,
	log: ['query', 'info', 'warn', 'error'],
})

const shutdown = async () => {
	await prisma.$disconnect().catch(() => {})
	await pool.end().catch(() => {})
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

module.exports = prisma