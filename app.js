const cors = require('cors')
const bodyParser = require('body-parser')
const express = require('express')
const app = express()

const CognitoExpress = require('cognito-express')
const {getUserPool} = require("fleetmap-partners")
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: 'us-east-1' })


const cognitoByOrigin = {}

function getCognito(origin) {
    if (!cognitoByOrigin[origin]) {
        cognitoByOrigin[origin] = new CognitoExpress({
            region: 'us-east-1',
            cognitoUserPoolId: getUserPool(origin),
            tokenUse: 'access', // Possible Values: access | id
            tokenExpiration: 3600000 // Up to default expiration of 1 hour (3600000 ms)
        })
    }
    return cognitoByOrigin[origin]
}


// noinspection JSCheckFunctionSignatures
app.use(cors({ origin: true, credentials:true, methods: 'GET,PUT,POST,DELETE,OPTIONS' }))
app.use(bodyParser.json())

app.use(async function (req, res, next) {
    try {
        const cognitoExpress = getCognito(req.headers.origin)
        const accessTokenFromClient = req.headers.authorization
        if (!accessTokenFromClient) return res.status(401).send('Access Token missing from header')
        const {username} = await cognitoExpress.validate(accessTokenFromClient.replace('Bearer ', ''))
        const resp = await client.send(new AdminGetUserCommand({Username: username, UserPoolId: getUserPool(req.headers.origin)}))
        res.locals.user = resp.UserAttributes.find(a => a.Name === 'email').Value
    } catch(e) {
        res.status(500).json(e.message)
    }
    next()
})


app.get('/', (req, resp) => {
    resp.json({hello: resp.locals.user})
})

module.exports = app

