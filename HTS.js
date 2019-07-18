const axios = require('axios')
const qs = require('query-string')
const fs = require ('fs')
const path = require ('path')
const isurl = require('is-url')
const express = require ('express')
const _ = require('lodash')
const EventEmitter = require('events').EventEmitter
const options = {
    url: "https://www.translated.net/hts/index.php",
    receiverPath: "receiveTranslation", //unused now
    receiverPort: 8080, //unused now
}


class HTS extends EventEmitter {
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
        // HERE I WOURLD START AN LISTINGIN SERVER ABLE TO RECEIVE THE TRANSLATIONS
        // the right ENDPOINT WILL BE CORRECTLY SET DURING THE QUOTE PHASE

        // DELAYED: THIS PART WILL BE DEVELOPED LATER
        return true

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
    _validateQuoteParams(source_language, target_languages, pn, jt, df, words, text, delivery_endpoint, tm, ie, subject, instructions) {
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
            throw new Error("Invalid job type (T=Translation, R=Revision, P=Postediting are the allowed values)")
        }

        if (!['base64'].includes(ie)) {
            throw new Error("Invalid input encoding. Only 'base64' allowed")
        }


        if (delivery_endpoint && !this._isUrl(delivery_endpoint)) {
            throw new Error("delivery parameter can only contain a valid public url. Example: delivery =https://site.com/receiveTranslation")
        }

        if (_.isArray(target_languages)){
            // HTS currently dows not support multiple target as array. It only support csv list of langages
            target_languages = target_languages.join()
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
        if (ie) {
            parameters.ie = ie
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


    async quote(source_language = "", target_languages = [], pn = "", jt = "T", df = "txt", words = 0, text = "", delivery_endpoint = "", tm = "", ie="",  subject = "", instructions = "") {
        let params = this._validateQuoteParams(source_language, target_languages, pn, jt, df, words, text, delivery_endpoint, tm, ie, subject, instructions)
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

exports.HTS = HTS