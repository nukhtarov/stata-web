// Выбор и чтение файлов в браузере.
import type { FileRequest } from '../lang/command';

export async function readFile(f: File): Promise<FileRequest> {
  return { name: f.name, data: await f.arrayBuffer() };
}

/** Открыть диалог выбора Excel-файла. null — пользователь отменил. */
export function pickFile(_hint = ''): Promise<FileRequest | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
    input.style.display = 'none';
    let done = false;
    const finish = (v: FileRequest | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      finish(f ? await readFile(f) : null);
    });
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export function isExcel(name: string) {
  return /\.(xlsx|xlsm|xls)$/i.test(name);
}
