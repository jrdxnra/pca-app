'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { importRebrandMovements } from '@/lib/scripts/import-rebrand-to-pca';

export default function ImportRebrandPage() {
  const [jsonData, setJsonData] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!jsonData.trim()) {
      setError('Please paste JSON data first');
      return;
    }

    try {
      const data = JSON.parse(jsonData);
      
      // Validate data structure
      if (!data.categories || !data.movements) {
        throw new Error('Invalid data format. Expected { categories: [], movements: {} }');
      }

      setLoading(true);
      setError(null);
      
      const result = await importRebrandMovements(data);
      setResult(result);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Import Rebrand Fitness Movements</CardTitle>
          <CardDescription>
            Paste the JSON data extracted from Rebrand Fitness to bulk import all movements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rebrand Fitness JSON Data</label>
            <Textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder='{ "categories": [...], "movements": {...} }'
              className="font-mono text-sm min-h-[300px]"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 px-4 py-3 rounded">
              <h3 className="font-semibold mb-2">Import Complete!</h3>
              <ul className="space-y-1 text-sm">
                <li>✅ Imported: {result.imported}</li>
                <li>⏭️ Skipped: {result.skipped}</li>
                <li>❌ Errors: {result.errors}</li>
              </ul>
            </div>
          )}

          <Button 
            onClick={handleImport} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Importing...' : 'Import Movements'}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-2 list-decimal pl-5">
            <li>Use the scraper tool to extract data from Rebrand Fitness</li>
            <li>Copy the JSON output</li>
            <li>Paste it into the textarea above</li>
            <li>Click &quot;Import Movements&quot;</li>
            <li>The script will automatically assign sensible configurations based on movement names</li>
            <li>You can adjust configurations later in the Movements page</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

