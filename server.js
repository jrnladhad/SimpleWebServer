const net = require('net');

const STATUS_CODE = {
    // INFORMATION RESPONSES
    '100': 'Continue',
    '101': 'Switching Protocol',
    '103': 'Early Hints',
    // SUCCESSFUL RESPONSES
    '200': 'OK',
    '201': 'Created',
    '202': 'Accepted',
    '203': 'Non-Authoritative Information',
    '204': 'No Content',
    '205': 'Reset Content', 
    // REDIRECTION MESSAGES
    '300': 'Multiple Choice',
    '301': 'Moved Permanently',
    '302': 'Found',
    '303': 'See Other',
    '304': 'Not Modified',
    '307': 'Temporaru Redirect',
    '308': 'Permanent Redirect',
    // CLIENT ERROR RESPONSES
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '406': 'Not Acceptable',
    '407': 'Proxy Authentication Required',
    '408': 'Request Timeout',
    '409': 'Conflict',
    '410': 'Gone',
    '411': 'Length Required',
    '412': 'Precondition Failed',
    '413': 'Payload Too Large',
    '414': 'URI Too Long',
    '415': 'Unsupported Media Type',
    '416': 'Range Not Satisfiable',
    '417': 'Expectation Failed',
    '418': 'I\'m a teapot',
    '425': 'Too Early',
    '426': 'Upgrade Required',
    '428': 'Precondition Required',
    '429': 'Too Many Requests',
    '431': 'Request Header Fields Too Large',
    '451': 'Unavailable For Legal Reasons',
    // SERVER ERROR RESPONSES
    '500': 'Internal Server Error',
    '501': 'Not Implemented',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Timeout',
    '505': 'HTTP Version Not Supported',
    '506': 'Variant Also Negotiates',
    '510': 'Not Extended',
    '511': 'Network AUthentication Required',
}

let request = {};
const responseHeader = {
    server: 'my-mac-server',
};

function parseRequest(req) {
    const endMarker = req.indexOf('\r\n\r\n');
    const reqHeader = req.slice(0, endMarker).toString();
    const reqBody = req.slice(endMarker + 4).toString();
    const reqLines = reqHeader.split('\r\n');
    const firstLine = reqLines.shift().split(' ');

    request['method'] = firstLine[0].trim();
    request['url'] = firstLine[1].trim();
    request['version'] = firstLine[2].split('/')[1];
    request = reqLines.reduce((acc, currLine) => {
        const [key, value] = currLine.split(':');
        return {
            ...acc,
            [key.trim()]: value.trim(),
        };
    }, request);
    request['body'] = reqBody;
}

function setHeader(key, value) {
    responseHeader[key] = value;
}

function createWebServer(port, requestHandler){
    const server = net.createServer();
    server.on('connection', handleConnection).listen(port ? port : 3000);

    function handleConnection(socket) {
        socket.on('error', (err) => {
            console.error(err.stack);
        });

        socket.on('readable', () => {
            const req = socket.read();
            parseRequest(req);

            let headerSent = false;
            let internalBuffer = '';

            function sendHeaderToBuffer() {
                if(!headerSent){
                    setHeader('Date', new Date().toUTCString());
                    Object.keys(responseHeader).forEach(headerKey => {
                        socket.write(`${headerKey}: ${responseHeader[headerKey]}\r\n`);
                    });
                    socket.write('\r\n');
                }
            }

            const response = {
                setBody: function setBody(data) {
                    internalBuffer = internalBuffer + data;
                },

                end: function end(data) {
                    const body = data ? internalBuffer + data : internalBuffer;
                    if(!headerSent){
                        setHeader('Content-Length', data ? data.length + internalBuffer.length : internalBuffer.length);
                        sendHeaderToBuffer();
                        headerSent = true;
                        socket.write(body + '\r\n');
                        socket.end();
                    } else {
                        socket.end(body);
                    }
                },

                setStatus: function setStatus(statusCode) {
                    const firstReqLine = 'HTTP/' + request['version'] + ' ' + statusCode.toString() + ' ' + STATUS_CODE[statusCode.toString()] + '\r\n';
                    socket.write(firstReqLine);
                },

                setHeader: setHeader,
            };

            requestHandler(request, response);
        });
    }
}