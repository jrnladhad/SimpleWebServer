const net = require('net');

function createWebServer(port, requestHandler){
    const server = net.createServer();
    server.on('connection', handleConnection).listen(port ? port : 3000);

    function handleConnection(socket) {
        socket.once('readable', () => {
            const req = socket.read();

            const endMarker = req.indexOf('\r\n\r\n');
            const reqHeader = req.slice(0, endMarker).toString();

            const reqLines = reqHeader.split('\r\n');
            const firstLine = reqLines.shift().split(' ');

            let request = {};
            request['method'] = firstLine[0].trim();
            request['version'] = firstLine[2].split('/')[1].trim();
            request['url'] = firstLine[1].trim();
            request = reqLines.reduce((acc, currLine) => {
                const [key, value] = currLine.split(':');
                return {
                    ...acc,
                [   key.trim()]: value.trim(),
                };
            }, request);

            let status = 200, message = 'OK', isChunked = false;
            const responseHeaders = {
                server: 'my-mac-server',
            }

            function setResponseHeader(key, value) {
                responseHeaders[key] = value;
            }

            function sendHeader() {
                setResponseHeader('Date', new Date().toUTCString());
                socket.write(`HTTP/${request['version']} ${status} ${message}\r\n`);
                Object.keys(responseHeaders).forEach(headerKey => {
                    socket.write(`${headerKey} : ${responseHeaders[headerKey]}\r\n`);
                });
                socket.write('\r\n');
            }

            const response = {
                write: function write(data) {
                    if(!responseHeaders['Content-Length']){
                        isChunked = true;
                        setResponseHeader('Transfer-Encoding', 'Chunked');
                    }
                    sendHeader();
                    if(isChunked) {
                        const size = data.length.toString(16);
                        socket.write(`${size}\r\n`);
                        socket.write(data);
                        socket.write(`\r\n`);
                    } else {
                        socket.write(data);
                    }
                },

                end: function end(data) {
                    if(!responseHeaders['Content-Length']){
                        setResponseHeader('Content-Length', data ? data.length : 0);
                    }
                    sendHeader();
                    if(isChunked) {
                        if(data) {
                            const size = data.length.toString(16);
                            socket.write(`${size}\r\n`);
                            socket.write(data);
                            socket.write(`\r\n`);
                        }
                        socket.end('0\r\n\r\n');
                    } else {
                        socket.end(data);
                    }
                },

                setStatus: function setStatus(statusCode, statusMessage) {
                    status = statusCode;
                    message = statusMessage;
                },

                setResponseHeader: setResponseHeader,
            };

            requestHandler(request, response);
        });
    }
}