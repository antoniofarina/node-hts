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
        a.getDelivered("./examples.desktop").then ((content ) => {
            console.log (content)
        })
    })
