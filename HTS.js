const axios = require('axios')
const qs = require('query-string')
const fs = require ('fs')
const path = require ('path')
const isurl = require('is-url')
const dotenv = require ('dotenv')
const _ = require('lodash')

dotenv.config({'path': path.join(process.cwd(), '/config/HTS.env')})
const HOSTNAME=process.env.HOSTNAME
const CID=process.env.CID
const PASS=process.env.PASS
const DATAFOLDER=process.env.DATAFOLDER
const LANGUAGESFOLDER=process.env.LANGUAGESFOLDER



class HTS  {
     constructor() {
        this.cid = CID
        this.password = PASS
        this.languageList = null

        if (!fs.existsSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER))){
            fs.mkdirSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER),{recursive: true})
        }

        if (fs.existsSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'))){
            let languages = fs.readFileSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'))
            this.languageList = JSON.parse(languages)
        }

        if (!this.languageList || Object.keys(this.languageList).length === 0){
            this._storeLanguagesList().then(() => {
                console.log ("list", this.languageList)
            })
        }

    }

    /* UTILS */


    _isUrl(url) {
        return isurl(url)
    }

    _formatLanguageList (json_list) {

        let list = {iso3066:[], iso6391:[]}
        Object.values(json_list).map ((lang) => {

            list.iso3066.push(lang.rfc3066)
            list.iso6391.push(lang.iso6391)
        })
        return list


    }

    /* VALIDATORS */

    _getDefaultParameters (){
        let parameters = {}
        parameters.cid = this.cid
        parameters.p = this.password
        parameters.of = 'json'
        parameters.verbose = 'true'
        return parameters
    }
    _validateLanguageListParameter(){
        let parameters = this._getDefaultParameters()
        parameters.f = 'll'
        return parameters
    }

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

        let parameters = this._getDefaultParameters()
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

        let parameters = this._getDefaultParameters()
        parameters.f = 'confirm'
        parameters.c = 1
        parameters.pid = pid
        return parameters
    }

    _validateStatusParams(pid = 0) {
        if (!_.isInteger(pid) || pid === 0) {
            throw new Error("Missing pid (project id)")
        }

        let parameters = this._getDefaultParameters()
        parameters.f = 'status'
        parameters.pid = pid
        return parameters
    }

    async _post(params){
        return new Promise(async(resolve, reject) => {
            try {
                // console.log("params ", params)
                let res = await axios.post(HOSTNAME, qs.stringify(params, {arrayFormat: 'bracket'}))
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

    async _storeLanguagesList() {
        let params = this._validateLanguageListParameter()
        let list = await this._post(params)
        let languages_list = this._formatLanguageList(list)
        fs.writeFileSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'), JSON.stringify(languages_list))
        this.languageList =  languages_list
    }



}

exports.HTS = HTS