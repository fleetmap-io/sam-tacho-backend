const cors = require('cors')
const bodyParser = require('body-parser')
const express = require('express')
const app = express()

const CognitoExpress = require('cognito-express')
const {getUserPool} = require("fleetmap-partners")
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: 'us-east-1' })
const mysql = require('./mysql-reader')
const cognitoByOrigin = {}

function getCognito(origin) {
    if (!cognitoByOrigin[origin]) {
        cognitoByOrigin[origin] = new CognitoExpress({
            region: 'us-east-1',
            cognitoUserPoolId: getUserPool(origin),
            tokenUse: 'id', // Possible Values: access | id
            tokenExpiration: 3600000 // Up to default expiration of 1 hour (3600000 ms)
        })
    }
    return cognitoByOrigin[origin]
}

// noinspection JSCheckFunctionSignatures
app.use(cors({ origin: true, credentials:true, methods: 'GET,PUT,POST,DELETE,OPTIONS' }))
app.use(bodyParser.json())

async function validate(cognitoExpress, accessTokenFromClient, retry=3) {
    try {
        return await cognitoExpress.validate(accessTokenFromClient.replace('Bearer ', ''));
    } catch (e) {
        if (--retry) {
            return await validate(cognitoExpress, accessTokenFromClient, retry);
        } else {
            console.error('giving up', e)
        }
    }
}

app.use(async function (req, res, next) {
    const cognitoExpress = getCognito(req.headers.origin)
    const accessTokenFromClient = req.headers.authorization
    if (!accessTokenFromClient) return res.status(401).send('Access Token missing from header')
    const user = await validate(cognitoExpress, accessTokenFromClient)
    const resp = await client.send(new AdminGetUserCommand({Username: user['cognito:username'], UserPoolId: getUserPool(req.headers.origin)}))
    res.locals.user = resp.UserAttributes.find(a => a.Name === 'email').Value
    next()
})

const sqlTachoDownloads = `select tr.id, tr.requestdate, tr.startdate, tr.enddate, tr.status, tr.companyid, tr.type, tr.entityid, 
        tr.conclusiondate, tr.s3id, tr.automatic
        from tacho_remotedownload tr
        inner join tc_users u on traccar.json_extract_c(u.attributes, '$.companyId') = tr.companyid
        left join tc_user_device td on u.id = td.userid and tr.entityid = td.deviceid and tr.type = 'V'
        left join tc_user_driver tdr on u.id = tdr.userid and tr.entityid = tdr.driverid and tr.type = 'D'`

const groupBy = 'group by tr.id, tr.requestdate, tr.startdate, tr.enddate, tr.status, tr.companyid, tr.type, tr.entityid, tr.conclusiondate, tr.s3id, tr.automatic'

app.get('/', async (req, resp) => {
    try {
        const email = resp.locals.user
        console.log('TachoDownloads User:',email)
        const sql = `${sqlTachoDownloads} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.status in (0,1)
        ${groupBy}
        `
        resp.json( await mysql.query(sql))
    } catch (e) {
        resp.json({m: e.message})
    }
})
app.get('/tachostatus/', async (req, resp) => {
    try {
        const email = resp.locals.user
        console.log('Tacho Status User:',email)
        const sql = `select tr.lastupdate
        from tacho_remotedownload_last_update tr
        inner join tc_users u on traccar.json_extract_c(u.attributes, '$.companyId') = tr.companyid
        where u.email = '${email}'`
        const result = await mysql.query(sql)
        resp.json(result.length ? result[0] : null)
    } catch (e) {
        resp.json({m: e.message})
    }
})
app.post('/tachodownloads/', async (req, resp) => {
    try {
        const email = resp.locals.user
        const body = req.body
        console.log('TachoDownloads by dates User:',email,body)
        const sql = `${sqlTachoDownloads} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.requestdate > '${body.startDate}' and tr.requestdate < '${body.endDate}'
        ${groupBy}
        `
        resp.json( await mysql.query(sql))
    } catch (e) {
        resp.json({m: e.message})
    }
})
app.get('/lasttachodownloads/', async (req, resp) => {
    try {
        const email = resp.locals.user
        console.log('Last TachoDownloads User:',email)
        const sql = `${sqlTachoDownloads} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.id in (SELECT MAX(id) FROM tacho_remotedownload GROUP BY entityid, TYPE)
        ${groupBy}
        `
        resp.json( await mysql.query(sql))
    } catch (e) {
        resp.json({m: e.message})
    }
})
app.get('/tachoconnectionstatus/', async (req, resp) => {
    try {
        const email = resp.locals.user
        console.log('Tacho connection status:',email)
        const sql = `select ti.* from tacho_instalation ti 
        inner join tc_users u inner join tc_user_device td on u.id = td.userid and td.deviceid = ti.deviceid 
        where u.email = '${email}'
        `
        resp.json( await mysql.query(sql))
    } catch (e) {
        resp.json({m: e.message})
    }
})
app.get('/tachodownloads/:deviceId', async (req, resp) => {
    try {
        const email = resp.locals.user
        console.log('Get Tacho Downloads by device')
        const deviceId = req.params.deviceId
        const sql = `${sqlTachoDownloads} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and entityid=${deviceId}
        ${groupBy}
        order by requestdate desc limit 10
        `
        resp.json( await mysql.query(sql))
    } catch (e) {
        resp.json({m: e.message})
    }
})

module.exports = app

