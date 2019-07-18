const axios = require('axios')
const qs = require('query-string')
const fs = require ('fs')
const path = require ('path')
const isurl = require('is-url')
const _ = require('lodash')
const express = require ('express')
const EventEmitter = require('events').EventEmitter
const options = {
    url: "https://www.translated.net/hts/index_ANTONIO.php",
    receiverPath: "receiveTranslation",
    receiverPort: 8080
}


class Hts extends EventEmitter {
    constructor(cid, password) {
        super()
        if (!cid) {
            throw new Error("Missing cid (customer id).")
        }
        if (!password) {
            throw new Error("Missing password.")
        }

        this.cid = cid
        this.password = password

        this.receiverServer = null
        this.receiverPort = options.receiverPort
        this.receiverPath =  options.receiverPath
    }

    /* UTILS */

    _initReceiverServer() {
        // MOVE OUTSIDE OF THE CLASS: Does not works

        this.receiverServer = express()
        this.receiverServer.get(this.receiverPath, (req,res) => {
            let pid =req.pid
            let lang = req.lang
            let buff = new Buffer(data, 'base64');

            let filePath = path.join(__dirname, '/data/translations', pid +'_' + lang)
            fs.writeFileSync(filePath, buff )
            res.end()
        })
        this.receiverServer.listen (this.receiverPort)

    }

    _isUrl(url) {
        return isurl(url)
    }

    /* VALIDATORS */
    _validateQuoteParams(source_language, target_languages, pn, jt, df, words, text, delivery_endpoint, tm, subject, instructions) {
        if (!source_language) {
            throw new Error("Missing source language")
        }
        if (!target_languages) {
            throw new Error("Missing target languages")
        }

        if (words && text) {
            throw  new Error("Use only one between 'w' and 'text'.  ")
        }

        if (!words && !text) {
            throw  new Error("Missing 'w' (words)  or 'text' (text to be translated) ")
        }

        if (!text && words && !_.isInteger(words)) {
            throw  new Error("Invalid 'w' (words) parameter. Interger expected. Example  w=1000 ")
        }

        if (!['T', 'R', 'P'].includes(jt)) {
            throw new Error("Invalid job type (T=Translation, R=Revision, P=Postediting are the allowed values")
        }

        if (delivery_endpoint && !this._isUrl(delivery_endpoint)) {
            throw new Error("delivery parameter can only contain a valid public url. Example: delivery =https://site.com/receiveTranslation")
        }

        let parameters = {}
        parameters.cid = this.cid
        parameters.p = this.password
        parameters.of = 'json'
        parameters.verbose = 'true'
        parameters.f = 'quote'

        parameters.s = source_language
        parameters.t = target_languages
        if (pn) {
            parameters.pn = pn
        }
        if (jt) {
            parameters.jt = jt
        }
        if (df) {
            parameters.df = df
        }
        if (delivery_endpoint) {
            parameters.delivery = delivery_endpoint
        }
        if (tm) {
            parameters.tm = tm
        }
        if (subject) {
            parameters.subject = subject
        }
        if (words) {
            parameters.w = words
        }
        if (text) {
            parameters.text = text
        }
        if (instructions) {
            parameters.instructions = instructions
        }
        return parameters
    }

    _validateConfirmParams(pid = 0) {
        if (!_.isInteger(pid) || pid === 0) {
            throw new Error("Missing pid (project id)")
        }

        let parameters = {}
        parameters.cid = this.cid
        parameters.p = this.password
        parameters.of = 'json'
        parameters.verbose = 'true'
        parameters.f = 'confirm'
        parameters.c = 1
        parameters.pid = pid
        return parameters
    }

    _validateStatusParams(pid = 0) {
        if (!_.isInteger(pid) || pid === 0) {
            throw new Error("Missing pid (project id)")
        }

        let parameters = {}
        parameters.cid = this.cid
        parameters.p = this.password
        parameters.of = 'json'
        parameters.verbose = 'true'
        parameters.f = 'status'
        parameters.c = 1
        parameters.pid = pid
        return parameters
    }

    async _post(params){
        return new Promise(async(resolve, reject) => {
            try {
                // console.log("params ", params)
                let res = await axios.post(options.url, qs.stringify(params, {arrayFormat: 'bracket'}))
                if (res.data.code == 1) {
                    resolve(res.data)
                }else {
                    reject(res.data.message)
                }
            } catch (error){
                reject (error)
            }
        })

    }


    async quote(source_language = "", target_languages = [], pn = "", jt = "T", df = "txt", words = 0, text = "", delivery_endpoint = "", tm = "", subject = "", instructions = "") {
        let params = this._validateQuoteParams(source_language, target_languages, pn, jt, df, words, text, delivery_endpoint, tm, subject, instructions)
        return this._post(params)
    }

    async confirm(pid = 0) {
        let params = this._validateConfirmParams(pid)
        return this._post(params)
    }

    async status(pid = 0) {
        let params = this._validateStatusParams(pid)
        return await this._post(params)
    }

    async get_documentation_url() {
        return "https://translated.com/translation-api-specs"
    }

    async receiveTranslation() {
        return "To be implemented"
    }

    async getStatus(pid) {

    }

}

const a = new Hts('htsdemo', 'htsdemo5');
let pid = 0
a._initReceiverServer()
a.quote('en', ['it'], '', 'T', 'txt', 1000, '', '', '', '', '')
    .then((res) => {
        console.log(res)
        pid =res.pid
    })
    .then(() => a.confirm(pid))
    .then ((res) => {
        console.log(res)
        console.log ("confirmed")
    })
    .then (() => a.status(pid))
    .then((status) => {
        console.log (status)
    })
    .catch((error) => {console.error ("eeeee ", error)})

