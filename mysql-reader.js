const mysql = require('mysql2/promise')
const secrets = require('./secrets')
const db_server = 'db-read.pinme.io'
const db_database = 'traccar'
let pool = null
const _secret = secrets.getSecret('gpsmanager-db')

async function init() {
  const secret = await _secret
  pool = mysql.createConnection({
    host: db_server,
    user: secret.username,
    password: secret.password,
    database: db_database,
  })
  return pool
}

const _init = init()

async function query(sql) {
  await _init
  console.log('sql reader: ' + sql)
  return (await pool).query(sql)
}

exports.query = query
