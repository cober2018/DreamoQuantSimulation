"""注册验证码邮件。SMTP 账号只从环境变量读取，代码和仓库里不写任何凭据。"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage


class MailError(RuntimeError):
    pass


class SmtpMailer:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self.host, self.port, self.user, self.password, self.sender = host, port, user, password, sender

    def send(self, to: str, subject: str, body: str) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        msg.set_content(body)
        try:
            with smtplib.SMTP_SSL(self.host, self.port, context=ssl.create_default_context(), timeout=10) as s:
                s.login(self.user, self.password)
                s.send_message(msg)
        except (smtplib.SMTPException, OSError) as e:
            raise MailError("验证码邮件发送失败") from e
