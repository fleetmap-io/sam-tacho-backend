const mysql = require('mysql2/promise')
const secrets = require('./secrets')
const db_server = 'db-read.pinme.io'
const db_database = 'traccar'
const _connection = secrets.getSecret('gpsmanager-db').then(secret =>
  mysql.createConnection({
    host: db_server,
    user: secret.username,
    password: secret.password,
    database: db_database,
  })
)


async function query(sql) {
    const connection = await _connection
    const [result] = await connection.query(sql)
    return result
}

exports.query = query
