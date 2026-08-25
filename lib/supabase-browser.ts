"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./env";
let client:SupabaseClient|null=null;
export function getBrowserSupabase(){if(client)return client;const config=getPublicSupabaseConfig();if(!config)return null;client=createClient(config.url,config.publishableKey);return client}
export async function adminFetch(path:string,init:RequestInit={}){const supabase=getBrowserSupabase();const{data}=supabase?await supabase.auth.getSession():{data:{session:null}};const headers=new Headers(init.headers);if(data.session)headers.set("authorization",`Bearer ${data.session.access_token}`);if(typeof init.body==="string"&&!headers.has("content-type"))headers.set("content-type","application/json");return fetch(path,{...init,headers})}
