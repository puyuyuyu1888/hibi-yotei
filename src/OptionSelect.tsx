import { useState } from 'react';
import type { Option } from './model';

type Props = {
  label: string; options: Option[]; value: string; emptyLabel: string;
  onChange: (id: string) => void; onCreate: (name: string) => string;
  required?: boolean; onAddingChange?: (adding: boolean) => void;
};
const ADD_OPTION = '__add_option__';

export function OptionSelect({ label, options, value, emptyLabel, onChange, onCreate, required, onAddingChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const toggle = (next: boolean) => { setAdding(next); onAddingChange?.(next); setError(''); setName(''); };
  const create = () => {
    try {
      const id = onCreate(name);
      onChange(id); toggle(false);
    } catch (e) { setError((e as Error).message); }
  };
  return <div className="option-select">
    <label>{label}
      <select aria-label={label} required={required} value={value} onChange={e => {
        if (e.target.value === ADD_OPTION) toggle(true); else { onChange(e.target.value); if (adding) toggle(false); }
      }}>
        <option value="">{emptyLabel}</option>
        {options.filter(o => !o.deleted || o.id === value).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        <option value={ADD_OPTION}>＋ 新しいタイトルを追加</option>
      </select>
    </label>
    {adding && <div className="inline-option-editor">
      <label>新しいタイトル名<input autoFocus aria-label={`新しい${label}名`} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); create(); }
      }} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="inline-option-actions"><button type="button" className="secondary" onClick={() => toggle(false)}>キャンセル</button><button type="button" className="primary" onClick={create}>追加</button></div>
    </div>}
  </div>;
}
