use neon::types::extract::Error;

// Use #[neon::export] to export Rust functions as JavaScript functions.
// See more at: https://docs.rs/neon/latest/neon/attr.export.html

#[neon::export]
#[cfg(target_os = "windows")]
fn get_long_path_name(long_path: String) -> Result<String, Error> {
    let long_path = winsafe::GetLongPathName(&long_path)?;
    Ok(long_path)
}

#[neon::export]
#[cfg(not(target_os = "windows"))]
fn get_long_path_name(_long_path: String) -> Result<String, Error> {
    Err(Error::new("get_long_path_name is only supported on Windows"))
}
