// https://github.com/apollographql/apollo-server/tree/master/packages/apollo-server-express
import { ApolloServer } from 'apollo-server-express'
import bodyParser from 'body-parser'
import express from 'express'

import { verifyKunde } from './auth/jwt'
import { addKunde, alleKunden, deleteKunde, einKunde, login } from './db/mongo'
import { resolvers } from './graphql/resolvers'
import { typeDefs } from './graphql/typeDefs'
import { kundeModel, validateKunde } from './model/kunde'
import { logger } from './shared/logger'
import { HttpStatus } from './shared/statusCodes'

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }: any) => {
        const token = req.headers.authorization
        const kunde = verifyKunde(token)
        return { kunde }
    },
})

export const app = express()
server.applyMiddleware({ app })

//  https://medium.com/javascript-in-plain-english/typescript-with-node-and-express-js-why-when-and-how-eb6bc73edd5d
app.get('/', (req, res) => {
    res.send(`Hello World! ${req}`)
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

export const basePath = '/rest'
let errorMessage = {}

// Login
app.post(`${basePath}/login`, (request, response) => {
    login(request.body)
        .then((result) => {
            if (result.status === 'error') {
                errorMessage = { status: 'error', message: 'Falsche Mailadresse' }
                response.status(HttpStatus.FORBIDDEN).send(errorMessage)
            } else if (result.status === 'invalid') {
                errorMessage = { status: 'invalid', message: 'Falsches Passwort' }
                response.status(HttpStatus.FORBIDDEN).send(errorMessage)
            } else {
                response.send(result)
            }
        })
        .catch(error => {
            response.status(HttpStatus.INTERNAL_ERROR)
            response.send(error)
        })
})

// Alle Kunden ausgeben
app.get(`${basePath}/kunden`, (request, response) => {
    const token = request.headers.authorization
    if (typeof token === 'string') {
        const email = verifyKunde(token)
        if (email) {
            alleKunden(email)
                .then((kunden) => {
                    response.send(kunden)
                })
                .catch(error => {
                    response.status(HttpStatus.INTERNAL_ERROR)
                    response.send(error)
                })
            return
        }
        errorMessage = { status: 'invalid', message: 'Nicht authorisiert' }
        response.status(HttpStatus.UNAUTHORIZED).send(errorMessage)
    }
    return
})

// Einzelnen Kunden suchen
app.get(`${basePath}/kunden/:email`, (request, response) => {
    const token = request.headers.authorization
    if (typeof token === 'string') {
        const email = verifyKunde(token)
        if (email) {
            einKunde(kundeModel, request.params.id)
               .then((kunde) => {
                    response.send(kunde)
                })
                .catch(error => {
                    response.status(HttpStatus.INTERNAL_ERROR)
                    response.send(error)
                })
            return
        }
        errorMessage = { status: 'invalid', message: 'Nicht authorisiert' }
        response.status(HttpStatus.UNAUTHORIZED).send(errorMessage)
    }
    return
})

// Kunde anlegen
app.post(`${basePath}/kunden`, (request, response) => {
    const token = request.headers.authorization
    if (typeof token === 'string') {
        const email = verifyKunde(token)
        if (email) {
            const receivedKunde = request.query
            if (validateKunde(request.query)) {
                addKunde(receivedKunde)
                response.status(HttpStatus.CREATED)
                response.send(receivedKunde)
            } else {
                response.status(HttpStatus.BAD_REQUEST).send()
            }
        }
    }
})

// Kunde löschen
app.delete(`${basePath}/kunden/:email`, (request, response) => {
    const token = request.headers.authorization
    if (typeof token === 'string') {
        const email = verifyKunde(token)
        if (email) {
            deleteKunde(kundeModel, request.params.id)
                .then(() => {
                    response.status(HttpStatus.NO_CONTENT)
                })
                .catch(error => {
                    response.status(HttpStatus.NOT_FOUND)
                    response.send(error)
                })
            return
        }
        errorMessage = { status : 'invalid' , message: 'Nicht authorisiert'}
        response.status(HttpStatus.UNAUTHORIZED).send(errorMessage)
    }
    return
})

app.listen({ port: 4000 }, () =>
    logger.info(
        `🚀 Server gestartet unter http://localhost:4000${server.graphqlPath}`,
    ),
)
