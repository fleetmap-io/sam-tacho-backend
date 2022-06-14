const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const client = new SecretsManagerClient({region: 'us-east-1'})

exports.getSecret = async (secretName) => {
    const command = new GetSecretValueCommand({SecretId: secretName})
    const {SecretString} = await client.send(command);
    return JSON.parse(SecretString)
}
