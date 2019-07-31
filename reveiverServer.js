const axios = require('axios')
const qs = require('query-string')
const body_parser = require('body-parser')
const fs = require('fs')
const path = require('path')
const isurl = require('is-url')
const express = require('express')
const session = require('express-session')
const _ = require('lodash')
const dotenv = require('dotenv')

// console.log('conf file is : ', path.join(process.cwd(), '/config/hubspot_' + NODE_ENV + '.env'))

dotenv.config({'path': path.join(process.cwd(), '/config/HTS.env')})
dotenv.config({'path': path.join(process.cwd(), '/config/receiver.env')})
const HTTP = process.env.HTTP
const HTTPS = process.env.HTTPS
const HOSTNAME = process.env.HOSTNAME
const DATAFOLDER = process.env.DATAFOLDER
const RECEIVERPATH = process.env.RECEIVERPATH
const TRANSLATIONSFOLDER = path.join(DATAFOLDER,process.env.TRANSLATIONSFOLDER)

const app = express()
app.use(session({secret: "magnocavalloTranslation!", resave: false, saveUninitialized: true}))
app.use(body_parser.json({limit: '50mb', extended: true}))
app.use(body_parser.urlencoded({limit: '50mb', extended: true}))
// common task to all requests: tracing requests
app.all('/*', function (req, res, next) {
    let ss = req.session
    let ts = new Date().getTime()
    ss.ts = ts
    console.log(ts, ':', req.url)
    next()
})

app.listen(HTTP, async () => {
    if (!fs.existsSync(path.join(__dirname, TRANSLATIONSFOLDER))){
        fs.mkdirSync(path.join(__dirname, TRANSLATIONSFOLDER),{recursive: true})
    }
    console.log(`Listening on http://localhost:${HTTP}`)
})



// MAY BE WE WANT TO USE SECRET TO PROTECT THE ENDPOINT
/*app.use(function (req, res, next) {
    let request_secret = req.query[SECRET_KEY_NAME] ? req.query[SECRET_KEY_NAME] : req.body[SECRET_KEY_NAME] ? req.body[SECRET_KEY_NAME] : ''
    if (!request_secret || request_secret !== SECRET_KEY_VALUE) {
        _showError(req, res, path.basename(req.path), 403, 'Forbidden', '')
        // req.connection.destroy()
    } else {
        next()
    }
})

 */


const _showError = (req, res, path, status, message) => {
    console.error('> ', req.session.ts, ' : ', path, status, ' - ', message)
    if (message === 'ESOCKETTIMEDOUT' || message === 'ECONNRESET') { // avoid unchaught excpetion on res.status(undefined)
        message = 'Unable to connect to translatio receiver server. Try later';
        status = 500;
    }
    res.status(status)
    res.send(message)
    res.end()
}

app.all(RECEIVERPATH, async (req, res) => {
    let pid = req.query.pid || req.body.pid ||  ''
    let lang = req.query.lang || req.body.lang ||  ''
    let data = req.query.data || req.body.data || ''
    let df = req.query.df || req.body.df || ''
    let buff = Buffer.from(data, 'base64') || null;
    //let buff = null

    if (!pid) {
        let message = 'Missing required parameter pid (project id)'
        _showError(req, res, path.basename(req.path), 400, message)
        return
    }

    if (!df) {
        let message = 'Missing required parameter df (filetype). Allowed values are zip, html, json'
        _showError(req, res, path.basename(req.path), 400, message)
        return
    }

    if (!_.isInteger(pid)) {
        let message = 'Bad pid parameter (project id). I t must be an integer number'
        _showError(req, res, path.basename(req.path), 400, message)
        return
    }

    if (!lang) {
        let message = 'Missing required parameter lang (target lang)'
        _showError(req, res, path.basename(req.path), 400, message)
        return
    }

    if (!buff) {
        let message = 'Translation content seems to be missing'
        _showError(req, res, path.basename(req.path), 400, message)
        return
    }

    let filePath = path.join(__dirname, '/data/translations', pid + '_' + lang+ '.' + df)
    fs.writeFileSync(filePath, buff)
    res.end()
})

module.exports.receiverServer = app
