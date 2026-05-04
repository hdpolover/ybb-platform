import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

type ExcelRow = Record<string, string | number | boolean | Date | null | undefined>;

@Injectable()
export class ExcelService {
  async generateExcel(
    data: ExcelRow[],
    columns: Partial<ExcelJS.Column>[],
    sheetName = 'Report',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns;
    worksheet.addRows(data);

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async streamExcel(
    res: Response,
    data: ExcelRow[],
    columns: Partial<ExcelJS.Column>[],
    fileName: string,
    sheetName = 'Report',
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns;
    worksheet.addRows(data);
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  async streamExcelRows(
    res: Response,
    rows: AsyncIterable<ExcelRow>,
    columns: Partial<ExcelJS.Column>[],
    fileName: string,
    sheetName = 'Report',
  ) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}.xlsx`,
    );

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: false,
    });
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true };

    for await (const row of rows) {
      worksheet.addRow(row).commit();
    }

    worksheet.commit();
    await workbook.commit();
    res.end();
  }
}
