```tsx
import { useState } from 'react';
import { exportDatabase, importDatabase } from '@/lib/db';

export default function Backup() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const handleExport = async () => {
    try {
      const data = await exportDatabase();

      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();

      URL.revokeObjectURL(url);

      alert('备份成功');
    } catch (err) {
      console.error(err);
      alert('备份失败，请重试');
    }
  };

  const handleImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setError('');
    setBackupInfo(null);
    setSelectedFile(file);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 检查是不是我们的 POS 备份
      if (
        data.version !== 1 ||
        !Array.isArray(data.products) ||
        !Array.isArray(data.imeis) ||
        !Array.isArray(data.orders)
      ) {
        throw new Error('invalid');
      }

      setBackupInfo({
        date: data.exportDate,
        products: data.products.length,
        imeis: data.imeis.length,
        orders: data.orders.length,
        data
      });
    } catch (err) {
      console.error(err);
      setSelectedFile(null);
      setError('这个文件不是有效的手机店 POS 备份文件');
    }

    // 允许再次选择同一个文件
    e.target.value = '';
  };

  const handleRestore = async () => {
    if (!backupInfo || !selectedFile) return;

    const confirmed = window.confirm(
      '恢复备份会覆盖当前所有商品、IMEI和订单数据。\n\n确定要恢复这个备份吗？'
    );

    if (!confirmed) return;

    try {
      await importDatabase(backupInfo.data);

      alert('恢复成功！POS 系统将重新加载。');

      location.reload();
    } catch (err) {
      console.error(err);
      alert('恢复失败，请检查备份文件后重试');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">

        <h2 className="text-2xl font-bold text-white mb-8">
          数据备份
        </h2>

        {/* 导出备份 */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-white text-lg font-semibold mb-2">
            导出备份
          </h3>

          <p className="text-slate-400 text-sm mb-5">
            将商品、IMEI和历史订单保存到电脑。
          </p>

          <button
            onClick={handleExport}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium transition-colors"
          >
            导出备份
          </button>
        </div>

        {/* 恢复备份 */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-white text-lg font-semibold mb-2">
            恢复备份
          </h3>

          <p className="text-slate-400 text-sm mb-5">
            选择之前导出的 POS 备份文件。
          </p>

          <label className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium cursor-pointer transition-colors">
            选择备份文件
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {/* 错误提示 */}
          {error && (
            <div className="mt-5 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 备份信息 */}
          {backupInfo && (
            <div className="mt-6 bg-slate-800 rounded-xl p-5">

              <p className="text-white font-medium mb-4">
                已选择备份文件
              </p>

              <div className="space-y-2 text-sm">

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    文件
                  </span>
                  <span className="text-slate-200">
                    {selectedFile.name}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    备份日期
                  </span>
                  <span className="text-slate-200">
                    {new Date(backupInfo.date).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    商品
                  </span>
                  <span className="text-slate-200">
                    {backupInfo.products}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    IMEI
                  </span>
                  <span className="text-slate-200">
                    {backupInfo.imeis}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    订单
                  </span>
                  <span className="text-slate-200">
                    {backupInfo.orders}
                  </span>
                </div>

              </div>

              <button
                onClick={handleRestore}
                className="mt-6 w-full px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg text-white font-medium transition-colors"
              >
                确认恢复此备份
              </button>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
```
