import { exportDatabase, importDatabase } from '@/lib/db';

export default function Backup() {

  const handleExport = async () => {
    const data = await exportDatabase();

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download =
      `backup-${new Date()
        .toISOString()
        .slice(0,10)}.json`;

    a.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0];

    if (!file) return;

    const text = await file.text();

    const data = JSON.parse(text);

    if (
      !window.confirm(
        '恢复备份会覆盖当前所有数据，确定继续？'
      )
    ) {
      return;
    }

    await importDatabase(data);

    alert('恢复成功，请重新打开软件');

    location.reload();
  };

  return (
    <div className="p-6">

      <h2 className="text-2xl font-bold mb-6">
        数据备份
      </h2>

      <button
        onClick={handleExport}
        className="px-6 py-3 bg-green-600 rounded-lg text-white"
      >
        导出备份
      </button>

      <div className="mt-6">

        <input
          type="file"
          accept=".json"
          onChange={handleImport}
        />

      </div>

    </div>
  );
}
