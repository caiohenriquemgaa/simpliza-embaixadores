import { LoginForm } from "./login-form";
export default function LoginPage(){return <main className="adminShell"><div className="adminCard" style={{maxWidth:480}}><h1>Programa de Embaixadores</h1><p className="adminNotice">Use uma conta do Supabase Auth com <code>app_metadata.role = &quot;admin&quot;</code>.</p><LoginForm/></div></main>}
