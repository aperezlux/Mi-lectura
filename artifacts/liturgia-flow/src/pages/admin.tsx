import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, MessageCircle, AlertCircle, Sparkles } from "lucide-react";
import { useReaders, useReaderMutations, useCalendar, useCalendarMutations } from "@/hooks/use-liturgia";
import { formatDate, getLiturgicalSeason, checkProximityConflict, cn } from "@/lib/utils";
import type { Reader, CalendarEntry, CreateReaderInput, UpdateReaderInputLevel } from "@workspace/api-client-react";

// --- Simple UI Components inline for guaranteed availability and styling ---
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-border shadow-sm overflow-hidden", className)}>{children}</div>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive', size?: 'sm'|'md'|'lg'|'icon' }>(({ className, variant = 'primary', size = 'md', ...props }, ref) => {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-primary text-primary hover:bg-primary/5",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  };
  const sizes = { sm: "h-9 px-3 text-xs", md: "h-11 px-6 font-medium", lg: "h-14 px-8 text-lg font-medium", icon: "h-11 w-11 flex items-center justify-center" };
  return (
    <button ref={ref} className={cn("inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], className)} {...props} />
  );
});

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("flex h-12 w-full rounded-xl border border-border bg-transparent px-4 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
));

const Select = ({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: {label: string, value: string}[], placeholder?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-12 w-full rounded-xl border border-border bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default'|'outline'|'destructive'|'warning' }) => {
  const variants = {
    default: "bg-primary/10 text-primary",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive/10 text-destructive border border-destructive/20",
    warning: "bg-amber-100 text-amber-800 border border-amber-200"
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)}>{children}</span>;
}

const Dialog = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4">
          <Card className="w-full shadow-2xl p-6">
            <h2 className="text-2xl font-serif mb-6">{title}</h2>
            {children}
          </Card>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Sub-views ---

function ReadersTab() {
  const { data: readers = [], isLoading } = useReaders();
  const { create, update, remove } = useReaderMutations();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<Reader | null>(null);
  
  const [formData, setFormData] = useState({ name: '', whatsapp: '', level: 'Principiante' as UpdateReaderInputLevel });

  const openCreate = () => {
    setEditingReader(null);
    setFormData({ name: '', whatsapp: '', level: 'Principiante' });
    setIsModalOpen(true);
  };

  const openEdit = (r: Reader) => {
    setEditingReader(r);
    setFormData({ name: r.name, whatsapp: r.whatsapp, level: r.level });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReader) {
      update.mutate({ id: editingReader.id, data: formData });
    } else {
      create.mutate({ data: formData as CreateReaderInput });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("¿Seguro que deseas eliminar este lector?")) {
      remove.mutate({ id });
    }
  };

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif">Directorio de Lectores</h2>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-5 h-5" /> Nuevo Lector</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {readers.map(reader => (
          <Card key={reader.id} className="p-5 flex flex-col group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{reader.name}</h3>
                <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                  <MessageCircle className="w-3 h-3" /> {reader.whatsapp}
                </p>
              </div>
              <Badge variant={reader.level === 'Experto' ? 'default' : 'outline'}>{reader.level}</Badge>
            </div>
            <div className="mt-auto flex gap-2 pt-4 border-t border-border/50">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(reader)}>
                <Edit2 className="w-4 h-4 mr-2" /> Editar
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(reader.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {readers.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No hay lectores registrados aún.
          </div>
        )}
      </div>

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingReader ? "Editar Lector" : "Nuevo Lector"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre Completo</label>
            <Input required minLength={2} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Juan Pérez" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <Input required value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="Ej. +34600000000" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nivel</label>
            <Select 
              value={formData.level} 
              onChange={v => setFormData({...formData, level: v as UpdateReaderInputLevel})}
              options={[{label: 'Principiante', value: 'Principiante'}, {label: 'Experto', value: 'Experto'}]}
            />
          </div>
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={create.isPending || update.isPending}>Guardar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function CalendarTab() {
  const { data: calendar = [], isLoading } = useCalendar();
  const { data: readers = [] } = useReaders();
  const { updateEntry } = useCalendarMutations();
  
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ readerId: 0, logisticComment: '' });

  const handleEditClick = (entry: CalendarEntry) => {
    setEditingEntryId(entry.id);
    setEditData({ readerId: entry.readerId || 0, logisticComment: entry.logisticComment || '' });
  };

  const handleSaveEdit = (id: number) => {
    updateEntry.mutate({ 
      id, 
      data: { 
        readerId: editData.readerId === 0 ? undefined : editData.readerId, 
        logisticComment: editData.logisticComment,
        isVacant: editData.readerId === 0
      } 
    });
    setEditingEntryId(null);
  };

  const generateWhatsAppMessage = () => {
    let msg = `🙏 *Calendario Litúrgico de Lectores* 🙏\n\n`;
    let currentDate = "";
    
    // Sort by date then role
    const sorted = [...calendar].sort((a,b) => a.date.localeCompare(b.date));
    
    sorted.forEach(c => {
      if (c.date !== currentDate) {
        msg += `\n📅 *${formatDate(c.date)}*\n`;
        currentDate = c.date;
      }
      msg += `▪️ ${c.role}: ${c.isVacant ? '🚨 VACANTE' : c.readerName} ${c.logisticComment ? `(${c.logisticComment})` : ''}\n`;
    });
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (isLoading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-serif">Calendario Asignado</h2>
        <Button onClick={generateWhatsAppMessage} variant="outline" className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
          <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
        </Button>
      </div>

      <Card className="overflow-x-auto border border-primary/20 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="border-b-2 border-primary/25">
            <tr>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Fecha</th>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Temporada</th>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Rol</th>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Lector Asignado</th>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Comentario</th>
              <th className="px-4 py-3 font-semibold text-primary text-sm bg-secondary/70 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {calendar.map(entry => {
              const season = getLiturgicalSeason(entry.date);
              const isEditing = editingEntryId === entry.id;
              const conflict = entry.readerId ? checkProximityConflict(calendar, entry.readerId, entry.date) : false;
              const seasonBg: Record<string, string> = {
                "Verde": "rgba(134, 180, 134, 0.08)",
                "Morado": "rgba(140, 100, 180, 0.08)",
                "Dorado": "rgba(201, 146, 42, 0.10)",
                "Blanco": "rgba(220, 230, 250, 0.10)",
              };
              const rowBg = seasonBg[entry.liturgicalSeason ?? season.name] ?? "transparent";

              return (
                <tr key={entry.id} className="hover:brightness-95 transition-colors" style={{ background: rowBg }}>
                  <td className="px-4 py-4 font-medium whitespace-nowrap">{formatDate(entry.date)}</td>
                  <td className="px-4 py-4">
                    <Badge className={season.colorClass}>{season.name}</Badge>
                  </td>
                  <td className="px-4 py-4">{entry.role}</td>
                  
                  <td className="px-4 py-4">
                    {isEditing ? (
                      <Select 
                        value={editData.readerId.toString()} 
                        onChange={(v) => setEditData({...editData, readerId: Number(v)})}
                        options={[
                          {label: '-- VACANTE --', value: '0'},
                          ...readers.map(r => ({label: r.name, value: r.id.toString()}))
                        ]}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {entry.isVacant ? (
                          <Badge variant="destructive" className="text-xs font-bold px-3 py-1 uppercase tracking-widest">🚨 VACANTE</Badge>
                        ) : (
                          <span className="font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{entry.readerName}</span>
                        )}
                        {!entry.isVacant && conflict && (
                          <span title="Advertencia: Asignado en otra misa el mismo fin de semana" className="text-amber-500">
                            <AlertCircle className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-4 py-4">
                    {isEditing ? (
                      <Input 
                        value={editData.logisticComment} 
                        onChange={e => setEditData({...editData, logisticComment: e.target.value})} 
                        placeholder="Nota..."
                        className="h-10"
                      />
                    ) : (
                      <span className="text-muted-foreground">{entry.logisticComment || '-'}</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-4">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(entry.id)}>Guardar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEntryId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => handleEditClick(entry)}>
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {calendar.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No hay fechas generadas en el calendario actual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function GenerateTab() {
  const { generate } = useCalendarMutations();
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    period: '1month' as '15days' | '1month',
    rolesText: "Lector 1 Misa Sábado PM\nLector 2 Misa Sábado PM\nLector 1 Misa Domingo AM\nLector 2 Misa Domingo AM"
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const roles = formData.rolesText.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    
    if (window.confirm("Esto generará un nuevo bloque de fechas. ¿Continuar?")) {
      generate.mutate({
        data: {
          startDate: formData.startDate,
          period: formData.period,
          roles
        }
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-serif text-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" />
          Asignación Inteligente
        </h2>
        <p className="text-muted-foreground mt-2">
          Genera el calendario automáticamente. El algoritmo prioriza la equidad, respeta los bloqueos de los lectores y evita asignaciones contiguas en el mismo fin de semana.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
              <Input 
                type="date" 
                required 
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <Select 
                value={formData.period}
                onChange={v => setFormData({...formData, period: v as any})}
                options={[
                  {label: '1 Mes', value: '1month'},
                  {label: '15 Días', value: '15days'}
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Roles por Fin de Semana</label>
            <p className="text-xs text-muted-foreground mb-2">Ingresa un rol por línea. Se crearán estos espacios para cada fin de semana en el período.</p>
            <textarea 
              className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px]"
              value={formData.rolesText}
              onChange={e => setFormData({...formData, rolesText: e.target.value})}
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={generate.isPending}>
            {generate.isPending ? "Generando..." : "Generar y Asignar Calendario"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'readers'|'calendar'|'generate'>('readers');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-2 p-1.5 bg-muted/50 rounded-2xl w-full sm:w-fit border border-border">
        {(['readers', 'calendar', 'generate'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 relative",
              activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-black/5"
            )}
          >
            {activeTab === tab && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-white rounded-xl shadow-sm border border-border" style={{ zIndex: -1 }} />
            )}
            <span className="relative z-10 capitalize">{tab === 'readers' ? 'Lectores' : tab === 'calendar' ? 'Calendario' : 'Generar'}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'readers' && <ReadersTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'generate' && <GenerateTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
