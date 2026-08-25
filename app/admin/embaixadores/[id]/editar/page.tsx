import { AmbassadorEditor } from "../../ambassador-editor";
export default async function EditAmbassadorPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <AmbassadorEditor id={id}/>}
