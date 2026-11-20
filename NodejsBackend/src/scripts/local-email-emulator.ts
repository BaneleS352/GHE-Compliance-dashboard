import { createServer, type Socket } from "node:net";
import { createServer as createHttpServer } from "node:http";

const smtpPort = Number(process.env.LOCAL_SMTP_PORT || 2525);
const httpPort = Number(process.env.LOCAL_EMAIL_INBOX_PORT || 8025);
const messages: Array<{ receivedAt: string; raw: string }> = [];

function handleSmtp(socket: Socket): void {
  let buffer = "";
  let data = "";
  let inData = false;
  socket.setEncoding("utf8");
  socket.write("220 ghe-local-email ESMTP\r\n");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (inData) {
        if (line === ".") { messages.push({ receivedAt: new Date().toISOString(), raw: data }); data = ""; inData = false; socket.write("250 queued\r\n"); }
        else data += `${line}\n`;
      } else if (/^DATA$/i.test(line)) { inData = true; socket.write("354 end with <CRLF>.<CRLF>\r\n"); }
      else if (/^(QUIT)$/i.test(line)) { socket.end("221 bye\r\n"); }
      else socket.write("250 ok\r\n");
    }
  });
}

createServer(handleSmtp).listen(smtpPort, "127.0.0.1", () => console.log(`Local SMTP emulator listening on 127.0.0.1:${smtpPort}`));
createHttpServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(messages)); }).listen(httpPort, "127.0.0.1", () => console.log(`Local email inbox at http://127.0.0.1:${httpPort}`));
