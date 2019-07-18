const HTS = require ("./HTS.js").HTS

const a = new HTS('htsdemo', 'htsdemo5');
let pid = 0
a._initReceiverServer()
a.quote('en', ['it', 'FR'], '', 'T', 'txt', 1000, '', '', '', '', '')
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

