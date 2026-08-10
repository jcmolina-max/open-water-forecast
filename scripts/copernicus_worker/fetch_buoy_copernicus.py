import os
import sys
import datetime
import glob
import requests

def main():
    print("=" * 70)
    print("🛰️ COPERNICUS IN-SITU TAC: DESCARGA ESTRICTA DE ARCHIVOS NETCDF")
    print(f"⏰ Fecha/Hora Ejecución UTC: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    username = os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME", "jmolina12")
    password = os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD", "0018__Manger")
    webhook_url = os.environ.get(
        "GOOGLE_SHEETS_WEBHOOK_URL",
        "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec"
    )

    if not username or not password:
        print("❌ ERROR: Faltan credenciales.")
        sys.exit(1)

    try:
        import copernicusmarine
        import xarray as xr
        import numpy as np
    except ImportError as e:
        print(f"❌ ERROR: Librerías faltantes ({e}).")
        sys.exit(1)

    output_dir = "./copernicus_raw_files"
    os.makedirs(output_dir, exist_ok=True)

    dataset_id = "cmems_obs-ins_glo_phybgcwav_mynrt_na_irr"
    print(f"🔑 Autenticado como: {username}")
    print(f"📦 Dataset In-Situ TAC: {dataset_id}")

    patterns = ["*6100280*", "*61280*", "*MO_61*", "*Malaga*"]

    for pattern in patterns:
        try:
            print(f"🔍 Probando filtro: '{pattern}'...")
            copernicusmarine.get(
                username=username,
                password=password,
                dataset_id=dataset_id,
                filter=pattern,
                output_directory=output_dir,
                force_download=True,
                no_directories=True
            )
            nc_files = glob.glob(os.path.join(output_dir, "*.nc"))
            if nc_files:
                print(f"✅ ¡Archivo NetCDF real descargado!: {nc_files}")
                break
        except Exception as e:
            print(f"ℹ️ Respuesta del servidor con filtro '{pattern}': {e}")

    nc_files = glob.glob(os.path.join(output_dir, "*.nc"))
    if not nc_files:
        print("\n" + "!" * 70)
        print("❌ RESULTADO DE LA PRUEBA: NO SE ENCONTRÓ NINGÚN ARCHIVO NETCDF EN COPERNICUS.")
        print("   Copernicus no tiene indexado en este momento el archivo con los códigos 6100280 / 61280.")
        print("   NO SE REGISTRARÁ NINGÚN DATO EN GOOGLE SHEETS.")
        print("!" * 70)
        sys.exit(1)

    target_file = nc_files[0]
    print(f"\n📂 ABRIENDO ARCHIVO NETCDF REAL: {os.path.basename(target_file)}")
    ds = xr.open_dataset(target_file)
    print("📋 Variables reales disponibles en el sensor:", list(ds.data_vars.keys()))

    def get_var(names):
        for n in names:
            if n in ds:
                v = ds[n].values
                valid = v[~np.isnan(v)] if hasattr(v, '__iter__') else [v]
                if len(valid) > 0:
                    return float(valid[-1]), n
        return None, None

    vhm0, vhm0_name = get_var(["VHM0", "VAVH", "sea_surface_wave_significant_height"])
    vtpk, vtpk_name = get_var(["VTPK", "VTZA", "sea_surface_wave_peak_period"])
    vmdr, vmdr_name = get_var(["VMDR", "VPED", "sea_surface_wave_from_direction"])
    temp, temp_name = get_var(["TEMP", "sea_water_temperature"])

    print("\n📊 VALORES FÍSICOS EXTRAÍDOS DEL SENSOR REAL:")
    print(f"   🌊 Altura Significante Ola ({vhm0_name}): {vhm0} m")
    print(f"   ⏱️ Periodo Pico ({vtpk_name}):           {vtpk} s")
    print(f"   🧭 Dirección Oleaje ({vmdr_name}):       {vmdr}°")
    print(f"   🌡️ Temp. Agua del Mar ({temp_name}):    {temp} °C")

    payload = {
        "origenDato": f"Boya: Copernicus Real ({os.path.basename(target_file)[:20]})",
        "playa": "misericordia",
        "boyaAltura": round(vhm0, 2) if vhm0 else "",
        "boyaPeriodo": round(vtpk, 1) if vtpk else "",
        "boyaDireccion": round(vmdr, 0) if vmdr else "",
        "boyaTemp": round(temp, 1) if temp else "",
        "notasCalibracion": f"NetCDF Real: {os.path.basename(target_file)}"
    }

    print(f"\n📤 Enviando medición real al Webhook de Google Sheets...")
    resp = requests.post(webhook_url, json=payload, timeout=15)
    print(f"✅ Webhook respondió HTTP {resp.status_code}")
    print("🎉 Medición física real registrada en Google Sheets.")
    ds.close()

if __name__ == "__main__":
    main()
