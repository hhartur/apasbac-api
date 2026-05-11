import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  private wrap(content: string, title: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
      .container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
      .header{background:linear-gradient(135deg,#c0392b,#7b241c);padding:28px 32px;text-align:center}
      .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:.5px}
      .body{padding:28px 32px}
      .body p{color:#444;line-height:1.7;margin:0 0 16px}
      .btn{display:inline-block;background:#c0392b;color:#fff!important;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;margin:8px 0}
      .footer{background:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
    </style></head><body>
    <div class="container">
      <div class="header"><h1>🐾 APASBAC — ${title}</h1></div>
      <div class="body">${content}</div>
      <div class="footer">© ${new Date().getFullYear()} APASBAC — Associação Protetora de Animais de Dois Vizinhos, PR</div>
    </div></body></html>`;
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = this.wrap(`
      <p>Olá, <strong>${name}</strong>!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p style="text-align:center"><a href="${link}" class="btn">Redefinir Senha</a></p>
      <p>Este link é válido por <strong>2 horas</strong>. Se você não solicitou, ignore este e-mail.</p>
    `, 'Redefinição de Senha');
    await this.transporter.sendMail({ from: process.env.SMTP_FROM, to, subject: '🔐 Redefinição de Senha — APASBAC', html });
    this.logger.log(`E-mail de recuperação enviado para: ${to}`);
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    const html = this.wrap(`
      <p>Olá, <strong>${name}</strong>! Seja bem-vindo(a) à APASBAC! 🐾</p>
      <p>Sua conta foi criada com sucesso. Agora você pode acompanhar os animais disponíveis para adoção e muito mais.</p>
      <p style="text-align:center"><a href="${process.env.FRONTEND_URL}" class="btn">Acessar o Sistema</a></p>
    `, 'Bem-vindo(a)!');
    await this.transporter.sendMail({ from: process.env.SMTP_FROM, to, subject: '🐾 Bem-vindo(a) à APASBAC!', html });
  }

  async sendMonitoringReminder(to: string, name: string, animalName: string, dueDate: Date): Promise<void> {
    const html = this.wrap(`
      <p>Olá, <strong>${name}</strong>!</p>
      <p>Está na hora de enviar o relatório de acompanhamento do seu pet <strong>${animalName}</strong>.</p>
      <p>Prazo: <strong>${dueDate.toLocaleDateString('pt-BR')}</strong></p>
      <p>Envie 1 vídeo e 1 foto mostrando como o ${animalName} está! 📷</p>
      <p style="text-align:center"><a href="${process.env.FRONTEND_URL}/monitoring" class="btn">Enviar Relatório</a></p>
    `, 'Relatório de Acompanhamento');
    await this.transporter.sendMail({ from: process.env.SMTP_FROM, to, subject: `📋 Relatório de ${animalName} pendente — APASBAC`, html });
  }

  async sendMonitoringResult(to: string, name: string, animalName: string, approved: boolean, notes?: string): Promise<void> {
    const status = approved ? '✅ Aprovado' : '❌ Rejeitado';
    const color = approved ? '#1e8449' : '#c0392b';
    const html = this.wrap(`
      <p>Olá, <strong>${name}</strong>!</p>
      <p>O relatório de acompanhamento do <strong>${animalName}</strong> foi analisado.</p>
      <p>Status: <strong style="color:${color}">${status}</strong></p>
      ${notes ? `<p>Observações: ${notes}</p>` : ''}
    `, `Resultado do Relatório — ${animalName}`);
    await this.transporter.sendMail({ from: process.env.SMTP_FROM, to, subject: `${status} — Relatório de ${animalName} | APASBAC`, html });
  }
}
