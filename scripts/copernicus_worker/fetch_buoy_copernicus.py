import os
import sys
import datetime
import glob
import requests

def main():
    print("=" * 70)
    print("🛰️ COPERNICUS IN-SITU TAC: LECTURA DEL ARCHIVO DE HOY (BOYA 6100280)")
    print(f"⏰ Fecha/Hora Ejecución UTC: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    username = os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME", "jmolina12")
    password = os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD", "0018__Manger")
    webhook_url = os.environ.get(
        "GOOGLE_SHEETS_WEBHOOK_URL",
        "https://script.google.com/macros/s/AKfycbxj05C1DArK4ZQyQ16NNXlLnCWVbPdpLMz4TUOXhyA-6IEpALmofqfRzQ3fR7oJBsgd/exec"
    )

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
    today_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    print(f"🔑 Autenticado: {username}")
    print(f"📦 Buscando archivos de oleaje (WS) y temperatura (TS) para HOY ({today_str})...")

    # Filtro específico para descargar la estación 6100280
    try:
        copernicusmarine.get(
            username=username,
            password=password,
            dataset_id=dataset_id,
            filter="*6100280*",
            output_directory=output_dir,
            force_download=True,
            no_directories=True
        )
    except Exception as e:
        print(f"ℹ️ Descarga completada o aviso: {e}")

    # Seleccionar TODOS los archivos NetCDF y ordenar por fecha (el más reciente al final)
    nc_files = sorted(glob.glob(os.path.join(output_dir, "*.nc")))
    if not nc_files:
        print("❌ No se encontraron archivos .nc.")
        sys.exit(1)

    # Buscar el archivo más reciente de oleaje (WS) o temperatura (TS)
    target_file = nc_files[-1]
    
    print("\n" + "=" * 70)
    print(f"📂 ARCHIVO MÁS RECIENTE SELECCIONADO: {os.path.basename(target_file)}")
    print("=" * 70)

    ds = xr.open_dataset(target_file)
    print("📋 Variables físicas del sensor:", list(ds.data_vars.keys()))

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
    wspd, wspd_name = get_var(["WSPD", "wind_speed"])
    wdir, wdir_name = get_var(["WDIR", "wind_direction"])

    time_str = "Desconocida"
    if 'TIME' in ds:
        time_raw = ds['TIME'].values[-1]
        time_str = str(time_raw).replace('T', ' ')[:19]

    print("\n📊 VALORES FÍSICOS EXTRAÍDOS DEL SENSOR REAL DE LA BOYA:")
    print(f"   🌊 Altura Significante Ola ({vhm0_name}): {vhm0} m")
    print(f"   ⏱️ Periodo Pico ({vtpk_name}):           {vtpk} s")
    print(f"   🧭 Dirección Oleaje ({vmdr_name}):       {vmdr}°")
    print(f"   🌡️ Temp. Agua del Mar ({temp_name}):    {temp} °C")
    print(f"   💨 Viento Sensor ({wspd_name}):          {wspd} kn ({wdir}°)")
    print(f"   📅 Fecha/Hora Medición Sensor:          {time_str} UTC")
    print("=" * 70)

    payload = {
        "origenDato": f"Boya: Copernicus Sensor 6100280 ({time_str[:10]})",
        "playa": "misericordia",
        "boyaAltura": round(vhm0, 2) if vhm0 else "",
        "boyaPeriodo": round(vtpk, 1) if vtpk else "",
        "boyaDireccion": round(vmdr, 0) if vmdr else "",
        "boyaTemp": round(temp, 1) if temp else "",
        "vientoSpeed": round(wspd, 1) if wspd else "",
        "vientoDir": round(wdir, 0) if wdir else "",
        "notasCalibracion": f"Sensor NetCDF: {os.path.basename(target_file)} ({time_str} UTC)"
    }

    print(f"\n📤 Enviando medición al Webhook de Google Sheets...")
    resp = requests.post(webhook_url, json=payload, timeout=15)
    print(f"✅ Webhook respondió HTTP {resp.status_code}")
    ds.close()

if __name__ == "__main__":
    main()
