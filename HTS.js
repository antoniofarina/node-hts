const axios = require('axios')
const https = require ('https')
const qs = require('query-string')
const fs = require ('fs')
const path = require ('path')
const isurl = require('is-url')
const _ = require('lodash')
const sftp = require('ssh2-sftp-client');
const tmp = require('tmp');
const  isValidPath = require('is-valid-path');
const streamWrapper = require('through2');
const Duplex = require('stream').Duplex;
const mime = require('mime');
const util= require('util')


const HOSTNAME=process.env.HTS_HOSTNAME
const CID=process.env.HTS_CID
const PASS=process.env.HTS_PASS
const TMKEY = process.env.HTS_TMKEY
const SFTP_ENDPOINT = process.env.SFTP_ENDPOINT
const SFTP_PORT = (typeof process.env.SFTP_PORT !== 'undefined') ? process.env.SFTP_PORT : 22

const SFTP_USERNAME = process.env.SFTP_USERNAME
const SFTP_PASSWORD = process.env.SFTP_PASSWORD
const HTTP_ENDPOINT = process.env.HTTP_ENDPOINT

const DATAFOLDER = 'data'
const LANGUAGESFOLDER = 'languages'

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
            throw new Error("Invalid job type (T=Translation, R=Revision, P=Postediting are the allowed values)")
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
                let res = await axios.post(HOSTNAME, qs.stringify(params, {arrayFormat: 'bracket', timeout: 300000}))
                if (res.data.code == 1) {
                    resolve(res.data)
                } else {
                    console.log ('HTS library _post reported HTS error ', res)
                    if (res.data.message) {
                        reject(res.data.message)    
                    } else if (res.data) {
                        reject(res.data)
                    } else {
                        reject(res)
                    }
                    
                }
            } catch (error) {
                console.log ('HTS library _post reported throwed error ', error)
                reject (error)
            }
        })

    }


    async quote(source_language, target_languages = [], pn = '', jt = 'T', df = 'txt', words = 0, text = "", delivery_endpoint = HTTP_ENDPOINT, tm = TMKEY, subject = "", instructions = "") {
        let params = this._validateQuoteParams(source_language, target_languages, pn, jt, df, words, text, delivery_endpoint, tm, subject, instructions)
        return await this._post(params)
    }

    async confirm(pid = 0) {
        let params = this._validateConfirmParams(pid)
        return await this._post(params)
    }

    async status(pid = 0, structureOutput=false) {
        let params = this._validateStatusParams(pid)
        let status = await this._post(params)
        return (structureOutput ? this._formatStatusEndpointOutput(status): status)
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
    _formatStatusEndpointOutput(result) {
        let res = {}
        res['summary'] = { code: result.code, message: result.message, num_jobs: result.count }
        delete result.code
        delete result.message
        delete result.count

        res['details'] = {}

        // look for translation objects
        Object.keys(result).forEach((key) => {
            //console.log("key is ", key)
            if (result[key].type == 'TRANSLATION') {
                let obj = _.cloneDeep(result[key])
                let t = obj.target
                let jid = obj.jid
                delete obj.type
                delete obj.jid
                delete obj.target
                delete obj.id_job_revising //alwais zero in case of translation
                obj.revisions = {}

                if (!(t in res.details)) {
                    res.details[t] = {}
                }
                res.details[t][jid] = obj

                //reduce object
                delete result[key]
            }
        })

        // look for revision objects
        Object.keys(result).forEach((key) => {
            //console.log("key is ", key)
            if (result[key].type == 'REVISION' && result[key].id_job_revising>0) {
                let obj = _.cloneDeep(result[key])
                let t = obj.target
                let jid = obj.jid
                let id_job_revising = obj.id_job_revising
                delete obj.type
                delete obj.jid
                delete obj.target
                delete obj.id_job_revising
              
                if (!(id_job_revising in res.details[t])) {
                    res.details[t][id_job_revising] = {}
                    res.details[t][id_job_revising].revisions = {}
                }
                res.details[t][id_job_revising].revisions[jid] = obj

                //reduce object
                delete result[key]
            }
        })
       // console.log ("res1" , util.inspect(res, {showHidden: false, depth: null}), "------")
        return res
    }

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
        let index = _.indexOf(this.languagesList.iso3066, isoCode)
        if (index === -1) {
            index = _.indexOf(this.languagesList.iso6391, isoCode)
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

    // DOWNLOAD DELIVERED
    async _streamToResult (responseStream , savePath, enc='utf8'){
        //console.log(typeof responseStream)
        let writer = new Object()
        if (savePath) {
            if (isValidPath(savePath)) {
                writer = fs.createWriteStream(savePath)
            } else {
                throw new Error(`invalid save path ${savePath}`)
            }
        } else {
            writer = streamWrapper()
        }

        responseStream.pipe(writer)
       
        return new Promise((resolve, reject) => {
            let responseString = ''
            writer.on('finish', () => {
                if (!savePath) {                    
                    resolve({ 'content': responseString })
                } else {
                    resolve(true)
                }
            })
            writer.on('error', reject)
            writer.on('data', (data) => {
                if (!savePath) {
                    console.log("<< ", data)
                    responseString += (typeof enc === 'string') ? data.toString(enc) : data.toString()
                }
            })
        })
    }

    async _getSFTPClient (){

        const config = {
            host: SFTP_ENDPOINT,
            port: SFTP_PORT,
            username: SFTP_USERNAME
        };

        if (SFTP_PASSWORD) {
            config.password = SFTP_PASSWORD
        } else {
            if (!fs.existsSync(path.join(process.cwd(), '/config/hts_sftp_endpoint.key'))) {
                throw new Error("SFTP Error : neither password or pub key provided ")
            }
            config.privateKey = fs.readFileSync(path.join(process.cwd(), '/config/hts_sftp_endpoint.key'))

        }

        let sftp_client = new sftp()        
        await sftp_client.connect(config)
        return sftp_client 
    }

    async renameDeliveredSFTP(ftp_srcpath, ftp_dstpath = ''){        
        let sftp_client = await this._getSFTPClient()
        let path_type_src = await sftp_client.exists(ftp_srcpath)
        let path_type_dst = await sftp_client.exists(ftp_dstpath)
        if (!path_type_src) {
            let error = new Error(`SFTP Error : the path ${ftp_srcpath} does not exists`)
            error.name = "ftp_file_not_exists"
            await sftp_client.end();
            throw error             
        }
        if (path_type_src !== '-') { // d => folder ; - => file ; l => link
            let error = new Error(`SFTP Error : the path ${ftp_srcpath} is not a regular file (type is ${path_type_src})`)
            error.name = "ftp_regular_file_expected"
            await sftp_client.end();
            throw error
        }

        if (!path_type_dst) {
            if (!sftp_client.exists(path.dirname(ftp_dstpath))){
                let error = new Error(`SFTP Error : the path ${ftp_dstpath} does not exists`)
                error.name = "ftp_file_not_exists"
                await sftp_client.end();
                throw error 
            }
        }else {
            if (path_type_dst === 'd'){
                ftp_dstpath = path.join(ftp_dstpath, path.basename(ftp_srcpath)) // if folder is passed as dst path, than the moved file will have the same name as the source file
            }
        }
        await sftp_client.rename(ftp_srcpath, ftp_dstpath)
        await sftp_client.end();
    }

    async getDeliveredSFTPFileList(ftp_filepath) {
        let sftp_client = await this._getSFTPClient()

        let path_parts = path.parse(ftp_filepath)

        let path_to_check = ftp_filepath
        let pattern = path_parts.base
        if (pattern.includes("*")) {
            path_to_check = path_parts.dir.includes("*") ? '' : path_parts.dir
        }

        let path_type = await sftp_client.exists(path_to_check)
        if (!path_type) {
            let error = new Error(`SFTP Error : the path ${path_to_check} does not exists`)
            error.name = "ftp_file_not_exists"
            await sftp_client.end()
            throw error
        }

        if (path_type !== 'd') { // d => folder ; - => file ; l => link
            let error = new Error(`SFTP Error : the path ${ftp_filepath} is not a regular file (type is ${path_type})`)
            error.name = "ftp_folder_expected"
            await sftp_client.end()
            throw error
        }
        let list = await sftp_client.list(path_to_check, pattern)
        await sftp_client.end();

        let finalList = list.map((file) => {
            return {'name':file.name, 'type': file.type}
        })
        return  finalList

    }

    async getDeliveredSFTP(ftp_filepath, savePath = '', enc = 'utf8') {
        let sftp_client = await this._getSFTPClient()

        //  console.log (await sftp_client.list("."))
        

        let path_type = await sftp_client.exists(ftp_filepath)
        if (!path_type) {
            let error = new Error(`SFTP Error : the path ${ftp_filepath} does not exists`)
            error.name = "ftp_file_not_exists"
            await sftp_client.end()
            throw error
        }

        if (path_type !== '-') { // d => folder ; - => file ; l => link
            let error = new Error(`SFTP Error : the path ${ftp_filepath} is not a regular file (type is ${path_type})`)
            error.name = "ftp_regular_file_expected"
            await sftp_client.end()
            throw error
        }
        let stream = new Duplex();
        let contentBuffer = await sftp_client.get(ftp_filepath)
        stream.push(contentBuffer)
        stream.push(null) // to end the streaming
        await sftp_client.end()


        let content = await this._streamToResult(stream, savePath, enc)
        if (!savePath && _.isObject(content)) {
            content.extension = path.extname(ftp_filepath)
        }
        return content
    }
    
    async getDeliveredHTTPS(url, savePath='', enc='utf8') {
        
        const response = await axios({
            url: url,
            method: 'GET',
            responseType: 'stream'
        })

        try {
            let content =  await this._streamToResult(response.data,savePath, enc)
            if (!savePath && _.isObject(content)) {
                content.extension = mime.getExtension(response.headers['content-type'])
            }
            return content
        } catch (e){
            console.error(e)
            throw(e)
        }       
    }

    // DOWNLOAD DELIVERED END
}

exports.HTS = HTS
