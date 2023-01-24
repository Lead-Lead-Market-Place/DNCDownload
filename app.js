"use strict";
// const request = require('superagent');
const request = require("request").defaults({ encoding: null });
const decompress = require("decompress");
const readline = require('readline');

const fs = require('fs');
var soap = require('strong-soap').soap;
const mysql = require('mysql2');
const db_config = {
    host: 'leadlead-production-db-mysql-1-do-user-7613765-0.a.db.ondigitalocean.com',
    user: 'doadmin',
    password: 'rd2vpl86ue8fozvu',
    database: 'leadlead',
    port: 25060,
    sslmode: 'REQUIRED'
};
const connection = mysql.createConnection(db_config);

console.log('---------- start ---------');



// wsdl of the web service this client is going to invoke. For local wsdl you can use, url = './wsdls/stockquote.wsdl'
var url = 'https://telemarketing.donotcall.gov/DownloadSvc/DownloadSvc.asmx?WSDL';
const CoID = '10285183-97185';
var loginArgs = {
    strCoID: CoID,
    strCoPwd: 'mzG$Y.Z6rza7cK6',
    userType: 'Representative',
    enumCertify: 'Agree'
};

var options = {};
soap.createClient(url, options, function (err, client) {

    console.log('---------- createClient ---------');

    client.Login(loginArgs, function (err, result) {
        if (result.LoginResult.code === 'LoginOK') {
            var token = result.LoginResult.value;
            console.log('LoginOK');

            SubmitDeltaFileRequest(client, token);
        } else if (err != null) {
            console.log('LoginFailed : ' + err);

        }
    });

    console.log('---------- createClient End ---------');

});

function SubmitDeltaFileRequest(client, sessionToken) {
    var args = {
        strCoID: CoID,
        fileFormat: 'Flat',//'Xml',
        strSessionToken: sessionToken
    };
    client.SubmitDeltaFileRequest(args, function (err, res) {
        console.log('SubmitDeltaFileRequest res = ');

        console.log(res);
        var result = res.SubmitDeltaFileRequestResult;
        if (result.code === 'SubmitOK') {
            console.log('SubmitOK');

            var fileToken = result.value;//file token
            GetDeltaFileRequestStatus(client, sessionToken, fileToken);

        } else if (result.code === 'AlreadyDownloadedToday') {
            console.log('AlreadyDownloadedToday');
        } else if (err != null) {
            console.log('SubmitDeltaFileRequest : ' + err);
        }
    });
}

function GetDeltaFileRequestStatus(client, sessionToken, fileToken) {
    var args = {
        strCoID: CoID,
        strRequestedFileToken: fileToken,
        strSessionToken: sessionToken
    };
    client.GetDeltaFileRequestStatus(args, function (err, res) {
        // console.log(res);
        var result = res.GetDeltaFileRequestStatusResult;
        if (result.code === 'RequestPending') {
            console.log('GetDeltaFileRequestStatus : RequestPending');

            setTimeout(function () {
                console.log('This printed after about 2 minutes');
                GetDeltaFileRequestStatus(client, sessionToken, fileToken);
            }, 1000 * 60 * 2);

        } else if (result.code === 'RequestCompleted') {
            console.log('GetDeltaFileRequestStatus : RequestCompleted');

            GetDeltaFileUrl(client, sessionToken, fileToken);//

        } else if (result.code === 'NoChanges') {
            console.log('GetDeltaFileRequestStatus : NoChanges');

        } else if (err != null) {
            console.log('GetDeltaFileRequestStatus : ' + err);

        }
    });
}


function GetDeltaFileUrl(client, sessionToken, fileToken) {
    var args = {
        strCoID: CoID,
        strRequestedFileToken: fileToken,
        strSessionToken: sessionToken
    };
    client.GetDeltaFileUrl(args, function (err, res) {
        console.log(res);
        var result = res.GetDeltaFileUrlResult;
        if (result.code === 'DownloadOK') {
            var fileUrl = result.value;
            GetDNCFileByUrl(client, sessionToken, fileUrl);
        } else if (err != null) {
            console.log('GetDeltaFileUrl : ' + err);
        }
    });
}
async function processLineByLine(filePath) {
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        // Each line in input.txt will be successively available here as `line`.
        console.log(line);
        //9804327717,2022-12-07T02:20:18,A
        var arr = line.split(',');
        if(arr.length == 3){
            let phone = arr[0];
            console.log(phone);
            
        }
    }
}

function GetDNCFileByUrl(client, sessionToken, fileUrl) {
    var args = {
        strCoID: CoID,
        fileUrl: fileUrl,
        strSessionToken: sessionToken
    };
    client.GetDNCFileByUrl(args, function (err, res) {
        console.log('GetDNCFileByUrl result = ');
        console.log(res);
        var result = res.GetDNCFileByUrlResult;
        if (result !== null && result.code === 'DownloadOK') {
            console.log('DownloadOK');

            var content = result.value;//save content to local file

            let date_ob = new Date();
            let date = ("0" + date_ob.getDate()).slice(-2);
            let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
            let year = date_ob.getFullYear();
            var filePath = "./" + year + month + date + ".zip";
            console.log(filePath);

            let buff = new Buffer(content, 'base64');
            decompress(buff, "dist")
            .then((files) => {
                // console.log(files);
                if(files.length > 0){
                    let txtFile = files[0].path;
                    console.log(txtFile);

                    connection.connect((err) => {
                        if (err) {
                            console.log('error when connecting to db:', err);
                        } else {
                            console.log('Connected to MySQL Server!');
        
                            processLineByLine('dist/' + txtFile);

                        }
                    });
                }
            })
            .catch((error) => {
                console.log(error);
            });

            console.log('----------- The End -------------');


        } else if (err != null) {
            console.log('GetDNCFileByUrl : ' + err);

        } else {
            console.log('Download data is Empty');

        }
    });
}