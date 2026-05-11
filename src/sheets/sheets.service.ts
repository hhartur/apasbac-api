import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private sheets: sheets_v4.Sheets;
  private readonly spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';

  constructor() {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async ensureHeader(): Promise<void> {
    try {
      const res = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: 'A1:J1' });
      if (!res.data.values || res.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['ID', 'Data Envio', 'Nome Tutor', 'Email Tutor', 'Nome Animal', 'Raça', 'Link Vídeo', 'Links Imagens', 'Status', 'Observações']] },
        });
      }
    } catch (err) { this.logger.error('Erro ao verificar header do Sheets', err); }
  }

  async appendRow(data: {
    monitoringId: string; submittedAt: Date; tutorName: string; tutorEmail: string;
    animalName: string; animalBreed: string; videoUrl: string; imageUrls: string[];
    status: string; notes?: string;
  }): Promise<string> {
    await this.ensureHeader();
    const row = [
      data.monitoringId,
      data.submittedAt.toLocaleDateString('pt-BR'),
      data.tutorName,
      data.tutorEmail,
      data.animalName,
      data.animalBreed,
      data.videoUrl,
      data.imageUrls.join(' | '),
      data.status,
      data.notes || '',
    ];
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'A:J',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    const updatedRange = res.data.updates?.updatedRange || '';
    this.logger.log(`Linha adicionada ao Sheets: ${updatedRange}`);
    return updatedRange;
  }

  async updateStatus(rowId: string, status: string, notes?: string): Promise<void> {
    try {
      const range = rowId.replace(/[A-Z]+/, 'I').split(':')[0];
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${range}:J${range.replace(/\D/g, '')}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[status, notes || '']] },
      });
    } catch (err) { this.logger.error('Erro ao atualizar status no Sheets', err); }
  }
}
