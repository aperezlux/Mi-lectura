const { data: readers = [], isLoading: loadingReaders } = useReaders();
const [selectedReaderId, setSelectedReaderId] = useState<number | null>(null);
const [pin, setPin] = useState("");
const [authenticated, setAuthenticated] = useState(false);
const [pinError, setPinError] = useState("");
const { data: publishedCalendar = [] } = useCalendar({ publishedOnly: true });
const verifyPin = useVerifyReaderPin();

const selectedReader = Array.isArray(readers)
  ? readers.find(r => r.id === selectedReaderId)
  : null;

const needsPin = !!(selectedReader as any)?.hasPin;

const handleSelectReader = (id: number | null) => {
  setSelectedReaderId(id);
  setPin("");
  setPinError("");
  setAuthenticated(false);
  verifyPin.reset();
};

const handleVerifyPin = () => {
  if (!selectedReaderId || !pin.trim()) return;

  setPinError("");

  verifyPin.mutate(
    {
      data: {
        readerId: selectedReaderId,
        pin: pin.trim(),
      },
    },
    {
      onSuccess: () => {
        setAuthenticated(true);
      },
      onError: () => {
        setPinError("PIN incorrecto. Inténtalo de nuevo.");
      },
    }
  );
};

const showPinEntry =
  !!selectedReaderId &&
  !!selectedReader &&
  needsPin &&
  !authenticated;

const showContent =
  !!selectedReaderId &&
  !!selectedReader &&
  (authenticated || !needsPin);

const hasPublishedAssignments = selectedReaderId
  ? Array.isArray(publishedCalendar)
    ? publishedCalendar.some(c => c.readerId === selectedReaderId)
    : false
  : false;

return (
  <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
    {/* Header */}
    <div className="text-center space-y-3">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <UserCircle className="w-8 h-8 text-primary" />
      </div>

      <h1 className="text-3xl font-serif text-primary">
        Portal del Lector
      </h1>

      <p className="text-muted-foreground text-sm">
        Selecciona tu nombre para ver tus asignaciones y gestionar tu disponibilidad.
      </p>
    </div>

    {/* Reader selector */}
    <AnimatePresence mode="wait">
      {!showPinEntry && !showContent && (
        <motion.div
          key="selector"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="bg-white p-6 rounded-2xl border border-border shadow-sm"
        >
          <label className="block text-sm font-medium mb-2">
            Mi Nombre
          </label>

          {loadingReaders ? (
            <div className="h-14 bg-muted rounded-xl animate-pulse" />
          ) : (
            <select
              className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-4 text-lg font-medium text-primary focus-visible:outline-none focus-visible:border-primary transition-colors"
              value={selectedReaderId ?? ""}
              onChange={(e) =>
                handleSelectReader(Number(e.target.value) || null)
              }
            >
              <option value="">
                -- Selecciona tu nombre --
              </option>

              {Array.isArray(readers) &&
                readers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {(r as any).hasPin ? " 🔑" : ""}
                  </option>
                ))}
            </select>
          )}
        </motion.div>
      )}
    </AnimatePresence>

    {/* PIN */}
    <AnimatePresence mode="wait">
      {showPinEntry && (
        <motion.div
          key="pin-entry"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className="bg-white rounded-2xl border border-border shadow-lg overflow-hidden"
        >
          <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>

            <div>
              <p
                className="font-semibold text-primary text-sm"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                {selectedReader?.name}
              </p>

              <p className="text-xs text-muted-foreground">
                Ingresa tu PIN personal para continuar
              </p>
            </div>

            <button
              onClick={() => handleSelectReader(null)}
              className="ml-auto p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerifyPin();
                }
              }}
              placeholder="Tu PIN personal"
              autoFocus
              className="flex h-14 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-5 text-xl text-center tracking-[0.4em] font-semibold text-primary focus-visible:outline-none focus-visible:border-primary transition-colors"
            />

            {pinError && (
              <motion.p
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-destructive text-sm text-center flex items-center justify-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                {pinError}
              </motion.p>
            )}

            <button
              onClick={handleVerifyPin}
              disabled={!pin.trim() || verifyPin.isPending}
              className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {verifyPin.isPending ? "Verificando…" : "Entrar"}
            </button>

            <button
              onClick={() => handleSelectReader(null)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-1"
            >
              ← Cambiar nombre
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Content */}
    <AnimatePresence mode="wait">
      {showContent && selectedReader && (
        <motion.div
          key={selectedReaderId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-center justify-between bg-white/80 border border-primary/15 rounded-2xl px-4 py-2.5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />

              <span
                className="font-semibold text-primary"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                {selectedReader.name}
              </span>

              <span className="text-muted-foreground text-xs">
                · {selectedReader.level}
              </span>

              {needsPin && (
                <span className="flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                  <KeyRound className="w-2.5 h-2.5" />
                  Verificado
                </span>
              )}
            </div>

            <button
              onClick={() => handleSelectReader(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>

          {hasPublishedAssignments ? (
            <AssignmentsView
              readerId={selectedReaderId!}
              readerName={selectedReader.name}
              readerLevel={selectedReader.level}
            />
          ) : (
            <PrePublicationView
              readerId={selectedReaderId!}
              readerName={selectedReader.name}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);