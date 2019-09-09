const axios = require('axios')
const qs = require('query-string')
const fs = require ('fs')
const path = require ('path')
const isurl = require('is-url')
const dotenv = require ('dotenv')
const _ = require('lodash')
const sftp = require('ssh2-sftp-client');
const tmp = require('tmp');

dotenv.config({'path': path.join(process.cwd(), '/config/HTS.env')})
const HTS_CONFIG = require(path.join(process.cwd(), "/config/hts.json"))

const HOSTNAME=process.env.HOSTNAME
const CID=process.env.CID
const PASS=process.env.PASS
const TMKEY = process.env.TMKEY
const SFTP_ENDPOINT = process.env.SFTP_ENDPOINT
const SFTP_USERNAME = process.env.SFTP_USERNAME
const SFTP_PASSWORD = process.env.SFTP_PASSWORD

const DATAFOLDER = HTS_CONFIG.datafolder
const LANGUAGESFOLDER = HTS_CONFIG.languagesfolder

class HTS  {
     constructor() {
        this.cid = CID
        this.password = PASS
        this.languagesList = null

        if (!fs.existsSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER))){
            fs.mkdirSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER),{recursive: true})
        }

        this._loadLangagesList().then(() => {
            //console.log (this.languagesList)
        })

    }
    /* UTILS */


    _isUrl(url) {
        return isurl(url)
    }

    _formatLanguageList (json_list) {
        let list = { name: [], iso3066:[], iso6391:[]}        
        Object.values(json_list)
        .filter ((lang) => {
            //console.log("NAME ", lang.name, typeof (lang.name) === 'undefined')
            return typeof(lang.name) !== 'undefined'
        })
        .map ((lang) => {            
            list.name.push(lang.name)
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


    async quote(source_language = HTS_CONFIG.s, target_languages = [], pn = HTS_CONFIG.pn, jt = HTS_CONFIG.jt, df = HTS_CONFIG.df, words = 0, text = "", delivery_endpoint = "", tm = TMKEY, ie="",  subject = "", instructions = "") {
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

    async getSupportedLanguagesList (){        
        return this.languagesList
    }

    async get_documentation_url() {
        return "https://translated.com/translation-api-specs"
    }

    async _storeLanguagesList() {        
        let params = this._validateLanguageListParameter()
        let list = await this._post(params)
        let languages_list = this._formatLanguageList(list)    
        fs.writeFileSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'), JSON.stringify(languages_list), "utf8")
        return languages_list
    }

    async _loadLangagesList(){        
        if (!fs.existsSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'))){
            this.languagesList = await this._storeLanguagesList()
        }
        this.languagesList = JSON.parse(fs.readFileSync(path.join(__dirname, DATAFOLDER, LANGUAGESFOLDER, 'languages.json'), "utf8"))
    }

    //HELPERS 
    lang_iso6391FromName(langName = 'English') {
        let index = _.indexOf(this.languagesList.name, langName)
        if (index !== -1) {
            return this.languagesList.iso6391[index]
        }
        return null
    }

    lang_iso3066FromName(langName = 'English') {
        let index = _.indexOf(this.languagesList.name, langName)
        if (index !== -1) {
            return this.languagesList.iso3066[index]
        }
        return null
    }

    lang_nameFromIso(isoCode = 'en') {
        let index = _.indexOf(this.languagesList.name, iso3066)
        if (index === -1) {
            index = _.indexOf(this.languagesList.name, iso6391)
        }
        if (index !== -1) {
            return this.languagesList.name[index]
        }
        return null
    }

    isSupportedLang (lang){
        if (!lang){
            return null
        }
        let index = 0
        index = _.indexOf(this.languagesList.iso6391, lang)
        if (index === -1){
            index = _.indexOf(this.languagesList.iso3066, lang)
            if (index === -1) {
                index = _.indexOf(this.languagesList.name, lang)
            }
        }

        if (index ===-1) {
            return null
        }
        return { name: this.languagesList.name[index], iso6391: this.languagesList.iso6391[index], iso3066: this.languagesList.iso3066[index], }

    }

    async getDelivered(ftp_filepath) {
        const config = {
            host: SFTP_ENDPOINT,
            port: 22,
            username: SFTP_USERNAME
        };

        if (SFTP_PASSWORD) {
            config.password = SFTP_PASSWORD
        } else {
            if (!fs.existsSync(path.join(process.cwd(), '/config/hts_sftp_endpoint,key'))) {
                throw new Error("SFTP Error : neither password or pub key provided ")
            }
            config.privateKey = fs.readFileSync(path.join(process.cwd(), 'hts_sftp_endpoint.key'))
        }

        let sftp_client = new sftp()
        try {

            await sftp_client.connect(config)

          //  console.log (await sftp_client.list("."))

            let path_type = await sftp_client.exists(ftp_filepath)
            if (!path_type) {
                throw new Error(`SFTP Error : the path ${ftp_filepath} does not exists`)
            }

            if (path_type !== '-') { // d => folder ; - => file ; l => link
                throw new Error(`SFTP Error : the path ${ftp_filepath} is not a regular file (type is ${path_type})`)
            }

            let content = await sftp_client.get(ftp_filepath)  // may be I need encode in utf8 mode {encoding: utf8}
            //console.log ("content ", content.toString())
            sftp_client.end()
            return (content.toString())
        } catch (e) {
            throw new Error(`SFTP Error : error while fetching ${ftp_filepath}. Details :  ${e})`)
        }

    }
}

exports.HTS = HTS