// Estado de carga que se muestra MIENTRAS Clerk hidrata (vía <ClerkLoading>),
// para que el panel del formulario no aparezca en blanco ni salte. Spinner
// neutro (no imita el form, así no hay doble cambio al pintar el form real).
// Estilos en authDesign.css (.av-loading / .av-spin).
export default function AuthFormLoading() {
  return (
    <div className="av-loading" aria-label="Cargando…">
      <div className="av-spin" />
    </div>
  );
}
