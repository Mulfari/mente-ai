// Placeholder que se muestra MIENTRAS Clerk hidrata (vía <ClerkLoading>), para
// que el panel del formulario no aparezca en blanco / no salte. Imita la forma
// del diseño en el nuevo orden: campos arriba, botón, divisor y social abajo.
// Estilos en authDesign.css (.av-sk-*).
export default function AuthFormSkeleton() {
  return (
    <div className="av-sk" aria-hidden>
      <div className="av-sk-lbl" />
      <div className="av-sk-input" />
      <div className="av-sk-btn" />
      <div className="av-sk-div" />
      <div className="av-sk-social" />
    </div>
  );
}
