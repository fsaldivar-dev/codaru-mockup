//! Shared decoding for dialog exports and the standalone CLI. No Tauri dependency.
pub fn decode(content: &str, encoding: Option<&str>) -> Result<Vec<u8>, String> {
    if content.len() > 64 * 1024 * 1024 { return Err("La exportación supera 64 MB".into()); }
    match encoding.unwrap_or("utf8") {
        "utf8" => Ok(content.as_bytes().to_vec()),
        "base64" => {
            let bytes = content.as_bytes();
            if bytes.len() % 4 != 0 { return Err("Base64 inválido".into()); }
            let digit = |b: u8| -> Result<u32, String> { match b { b'A'..=b'Z' => Ok((b - b'A') as u32), b'a'..=b'z' => Ok((b - b'a' + 26) as u32), b'0'..=b'9' => Ok((b - b'0' + 52) as u32), b'+' => Ok(62), b'/' => Ok(63), _ => Err("Base64 inválido".into()) } };
            let mut out = Vec::with_capacity(bytes.len() / 4 * 3);
            for (index, part) in bytes.chunks_exact(4).enumerate() {
                let a = digit(part[0])?; let b = digit(part[1])?;
                let padding = if part[2] == b'=' { 2 } else if part[3] == b'=' { 1 } else { 0 };
                if padding > 0 && (index + 1 != bytes.len() / 4 || part[3] != b'=') { return Err("Base64 inválido".into()); }
                let c = if padding == 2 { 0 } else { digit(part[2])? };
                let d = if padding > 0 { 0 } else { digit(part[3])? };
                if (padding == 2 && b & 15 != 0) || (padding == 1 && c & 3 != 0) { return Err("Base64 inválido".into()); }
                let value = a << 18 | b << 12 | c << 6 | d;
                out.push((value >> 16) as u8);
                if padding < 2 { out.push((value >> 8) as u8); }
                if padding == 0 { out.push(value as u8); }
            }
            Ok(out)
        },
        _ => Err("Codificación no admitida: usa utf8 o base64".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_text_and_decodes_binary_with_strict_padding() {
        assert_eq!(decode("á", None).unwrap(), "á".as_bytes());
        assert_eq!(decode("iVBORw0KGgo=", Some("base64")).unwrap(), b"\x89PNG\r\n\x1a\n");
        assert_eq!(decode("UEsDBA==", Some("base64")).unwrap(), b"PK\x03\x04");
        for bad in ["a", "====", "YQ=Z", "YQ==YQ==", "YR==", "YWJ=", "YW J"] { assert!(decode(bad, Some("base64")).is_err(), "{bad}"); }
        assert!(decode("", Some("unknown")).is_err());
    }
}
