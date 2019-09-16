const HTS = require ("./HTS.js").HTS
//const receiver = require ("./reveiverServer.js").receiverServer

const a = new HTS();
a.getSupportedLanguagesList()
    .then((res) => {
        console.log(res)
        console.log( a.isSupportedLang("Afrikaans"))
        console.log(a.isSupportedLang("af") )
        console.log(a.isSupportedLang("af-za"))
        console.log(a.isSupportedLang("af-ZA"))
        console.log(a.isSupportedLang("cc") )

    })
    .then ( () => {
        
       /* a.getDeliveredSFTP2("./examples.desktop" , "/home/antonio/Scrivania/testDesltopFtp28.txt").then ((content ) => {
            console.log (content)
        })*/
        a.renameDeliveredSFTP('./delivered/25555676-Danish.zip', './merged/a.zip')
        /*a.getDeliveredHTTPS("http://ipv4.download.thinkbroadband.com/5MB.zip", "/home/antonio/Scrivania/testDesltophttpsss.txt").then ( (content) => {
            console.log (content)
        })*/
        
    })
    