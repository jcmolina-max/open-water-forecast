import os
import sys
import datetime
import glob
import requests

def main():
    print("=" * 70)
    print("🛰️ COPERNICUS IN-SITU TAC: LECTURA DE SERIES TEMPORALES (TS) DE HOY")
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
    print(f"🔑 Autenticado: {username}")
    print("📦 Descargando serie temporal (TS) de la Boya 6100280...")

    # Buscamos específicamente los archivos TS (Time Series) que contienen VHM0 y TEMP
    try:
        copernicusmarine.get(
            username=username,
            password=password,
            dataset_id=dataset_id,
            filter="*IR_TS_MO_6100280*",
            output_directory=output_dir,
            force_download=True,
            no_directories=True
        )
    except Exception as e:
        print(f"ℹ️ Aviso de descarga: {e}")

    # Seleccionar archivos TS y ordenar para coger el más reciente (el de hoy)
    ts_files = sorted(glob.glob(os.path.join(output_dir, "*IR_TS_MO_6100280*.nc")))
    if not ts_files:
        # Fallback a cualquier TS
        ts_files = sorted(glob.glob(os.path.join(output_dir, "*TS*.nc")))

    if not ts_files:
        print("❌ No se encontraron archivos de series temporales (TS).")
        sys.exit(1)

    target_file = ts_files[-1]
    print("\n" + "=" * 70)
    print(f"📂 ARCHIVO TIME-SERIES DE HOY: {os.path.basename(target_file)}")
    print("=" * 70)

    ds = xr.open_dataset(target_file)
    print("📋 Variables físicas encontradas:", list(ds.data_vars.keys()))

    def get_var(names):
        for n in names:
            if n in ds:
                v = ds[n].values
                valid = v[~np.isnan(v)] if hasattr(v, '__iter__') else [v]
                if len(valid) > 0:
                    return float(valid[-1]), n
        return None, None

    vhm0, vhm0_name = get_var(["VHM0", "VAVH", "sea_surface_wave_significant_height", "HCSP"])
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

    if vhm0 is None and temp is None:
        print("⚠️ Este archivo no contiene mediciones escalares.")
        ds.close()
        sys.exit(1)

    payload = {
        "origenDato": f"Boya: Copernicus In-Situ Real ({time_str[:10]})",
        "playa": "misericordia",
        "boyaAltura": round(vhm0, 2) if vhm0 is not None else "",
        "boyaPeriodo": round(vtpk, 1) if vtpk is not None else "",
        "boyaDireccion": round(vmdr, 0) if vmdr is not None else "",
        "boyaTemp": round(temp, 1) if temp is not None else "",
        "vientoSpeed": round(wspd, 1) if wspd is not None else "",
        "vientoDir": round(wdir, 0) if wdir is not None else "",
        "notasCalibracion": f"Sensor In-Situ TAC: {os.path.basename(target_file)} ({time_str} UTC)"
    }

    print(f"\n📤 Enviando medición física real a Google Sheets...")
    resp = requests.post(webhook_url, json=payload, timeout=15)
    print(f"✅ Webhook respondió HTTP {resp.status_code}")
    print("🎉 Medición registrada con éxito.")
    ds.close()

if __name__ == "__main__":
    main()
