import http from 'http';

export interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

export function testHttpRequest(
  server: http.Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  payload?: any
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const port = addr.port;

    const requestHeaders: Record<string, string> = { ...headers };
    let bodyData = '';

    if (payload !== undefined) {
      bodyData = typeof payload === 'string' ? payload : JSON.stringify(payload);
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(bodyData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: method.toUpperCase(),
        headers: requestHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          let parsedBody = rawData;
          try {
            parsedBody = JSON.parse(rawData);
          } catch {
            // keep raw string if not json
          }

          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsedBody,
          });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}
