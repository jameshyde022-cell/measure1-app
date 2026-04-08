import { supabase } from "./supabase";

export async function consumeExport() {
  const { data, error } = await supabase.rpc("consume_export");

  if (error) {
    throw error;
  }

  return data;
}

export async function getExportStatus() {
  const { data, error } = await supabase.rpc("get_export_status");

  if (error) {
    throw error;
  }

  return data;
}