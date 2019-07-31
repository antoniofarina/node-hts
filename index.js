const HTS = require ("./HTS.js").HTS
const receiver = require ("./reveiverServer.js").receiverServer

const a = new HTS('htsdemo', 'htsdemo5');
a._storeLanguagesList()
    .then((res) => {
        console.log(res)

    })
