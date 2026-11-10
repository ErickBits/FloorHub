import { useEffect, useId, useMemo, useRef, useState } from 'react';

export const normalize = (text) => String(text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function matches(query, ...fields) {
  const needle = normalize(query.trim());
  return !needle || fields.some((field) => normalize(field).includes(needle));
}

// Selector con buscador: con cientos de opciones es más rápido escribir que desplazarse.
// Cada opción es { value, label, hint?, group? }; las del mismo grupo deben ir seguidas.
export function SearchSelect({
  options, value, onChange, required = false, emptyLabel, placeholder = 'Escribe para buscar…', id, ...aria
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const allOptions = useMemo(
    () => (emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options),
    [options, emptyLabel],
  );
  const filtered = useMemo(
    () => allOptions.filter((option) => matches(query, option.label, option.hint, option.group)),
    [allOptions, query],
  );
  const selected = allOptions.find((option) => option.value === value);

  // La validación nativa del formulario usa el valor elegido, no el texto escrito.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? 'Elige una opción de la lista' : '');
  }, [required, value]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      return setActive((current) => Math.min(Math.max(current + step, 0), filtered.length - 1));
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
    return undefined;
  }

  return (
    <div className={`combo ${open ? 'combo-open' : ''}`}>
      <input
        {...aria}
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => { setOpen(true); setActive(0); }}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setQuery(''); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
      />
      <span className="combo-caret" aria-hidden="true" />
      {open && (
        <ul className="combo-list" id={listId} role="listbox">
          {filtered.length === 0 && <li className="combo-empty">Sin resultados</li>}
          {filtered.map((option, index) => (
            <OptionRow
              key={option.value || 'empty'}
              id={`${listId}-${index}`}
              option={option}
              showGroup={option.group && option.group !== filtered[index - 1]?.group}
              isActive={index === active}
              isSelected={option.value === value}
              onHover={() => setActive(index)}
              onChoose={() => choose(option)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OptionRow({ id, option, showGroup, isActive, isSelected, onHover, onChoose }) {
  return (
    <>
      {showGroup && <li className="combo-group" role="presentation">{option.group}</li>}
      <li
        id={id}
        role="option"
        aria-selected={isSelected}
        className={`combo-option ${isActive ? 'combo-option-active' : ''}`}
        // mousedown en vez de click: así el input no pierde el foco antes de elegir.
        onMouseDown={(event) => { event.preventDefault(); onChoose(); }}
        onMouseMove={onHover}
      >
        <span>{option.label}</span>
        {option.hint && <span className="combo-hint">{option.hint}</span>}
      </li>
    </>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Buscar…', label = 'Buscar' }) {
  return (
    <input
      type="search"
      className="search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
