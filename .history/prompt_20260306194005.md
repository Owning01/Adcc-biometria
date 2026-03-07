Ya se porque no estaba funcionando el mapeo y no estaba funcionando nada. Ahora te explico como es el flujo: 


1)con GET https://adccanning.com.ar/api/partidos ==> obtenemos los datos: 
"id": 35759,
            "dia": "2026-02-28 09:00:00",
            "fecha": 1,
            "minutos": 25,
            "cancha": "Saint Thomas Norte Sur",
            "local_id": 7853,
            "local_nombre": "Saint Thomas Norte Sur",
            "local_escudo": "https://adccanning.com.ar/img/lQ4CEnRAfw_Sin título-2_Mesa de trabajo 1 copia 22.png",
            "local_slug": "STNS",
            "res_local": null,
            "res_local_p": null,
            "visitante_id": 7902,
            "visitante_nombre": "Fecha Libre",
            "visitante_escudo": "https://adccanning.com.ar/img",
            "visitante_slug": "FL",
            "res_visitante": null,
            "res_visitante_p": null,
            "estado_partido": "pendiente",
            "liga": "Apertura Septima 2026",
            "torneo": "Apertura",
            "categoria": "Septima"

Ese id, lo usaremos para recopilar los datos de los jugadores que van a jugar dentro de ese partido 

Por lo que en paso 2):  GET https://adccanning.com.ar/api/partido/35759  <= es el id 

y recibimos algo asi: 
"partido": {
        "id": 35759,
        "dia": "2026-02-28 09:00:00",
        "fecha": 1,
        "minutos": 25,
        "cancha": "Saint Thomas Norte Sur",
        "local_id": 7853,
        "local_nombre": "Saint Thomas Norte Sur",
        "local_escudo": "https://adccanning.com.ar/img/lQ4CEnRAfw_Sin título-2_Mesa de trabajo 1 copia 22.png",
        "local_slug": "STNS",
        "res_local": null,
        "res_local_p": null,
        "visitante_id": 7902,
        "visitante_nombre": "Fecha Libre",
        "visitante_escudo": "https://adccanning.com.ar/img",
        "visitante_slug": "FL",
        "res_visitante": null,
        "res_visitante_p": null,
        "estado_partido": "pendiente",
        "liga": "Apertura Septima 2026",
        "torneo": "Apertura",
        "categoria": "Septima",
        "grupo_sancion": 4
    },
    "equipo_local": [
        {
            "id": 9529,
            "nrosocio": 28332,
            "apellido": "Boero",
            "nombre": "Tomás",
            "dni": 54699862,
            "imagen": "https://adccanning.com.ar/img/foto/ea23dbb2-6b44-4a50-a940-a242f7af705c.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180820,
            "sancionado": false
        },
        {
            "id": 14716,
            "nrosocio": 33336,
            "apellido": "Echegoyena",
            "nombre": "Thiago Valentin",
            "dni": 54607935,
            "imagen": "https://adccanning.com.ar/img/foto/2534ba9f970d5f8c7e56b52af6011de1.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 183418,
            "sancionado": false
        },
        {
            "id": 4609,
            "nrosocio": 23699,
            "apellido": "Fernandez",
            "nombre": "Benicio",
            "dni": 54456634,
            "imagen": "https://adccanning.com.ar/img/foto/fa11e937-7603-4284-ac5a-29eed1d50d7f.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180822,
            "sancionado": false
        },
        {
            "id": 6314,
            "nrosocio": 25256,
            "apellido": "Fraguglia",
            "nombre": "Ignacio",
            "dni": 54624003,
            "imagen": "https://adccanning.com.ar/img/foto/0b51e66d-16b4-41a7-9953-60f063b83d63.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 181197,
            "sancionado": false
        },
        {
            "id": 7013,
            "nrosocio": 25925,
            "apellido": "Gullo",
            "nombre": "Lautaro",
            "dni": 54627963,
            "imagen": "https://adccanning.com.ar/img/foto/c5c64033-90c9-4363-8238-42cf8a1bfc46.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 181198,
            "sancionado": false
        },
        {
            "id": 11300,
            "nrosocio": 30026,
            "apellido": "Lardieri",
            "nombre": "Francisco",
            "dni": 54697666,
            "imagen": "https://adccanning.com.ar/img/foto/d8a037d0-8b17-438e-acf4-1c7a979ac013.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180833,
            "sancionado": false
        },
        {
            "id": 6485,
            "nrosocio": 25415,
            "apellido": "Latuf",
            "nombre": "Pedro",
            "dni": 54703267,
            "imagen": "https://adccanning.com.ar/img/foto/bdad2bbd-77de-48ad-9bff-f45ae4f29987.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180823,
            "sancionado": false
        },
        {
            "id": 6890,
            "nrosocio": 25805,
            "apellido": "Mondino",
            "nombre": "Giovanni",
            "dni": 55295406,
            "imagen": "https://adccanning.com.ar/img/foto/fdc5cff9-e37e-4dfe-9951-99d0c55619ca.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180828,
            "sancionado": false
        },
        {
            "id": 7945,
            "nrosocio": 26794,
            "apellido": "Ramirez",
            "nombre": "Milo",
            "dni": 54704281,
            "imagen": "https://adccanning.com.ar/img/foto/7c92ec50-fa4c-4205-ad1e-799b8e288d83.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180831,
            "sancionado": false
        },
        {
            "id": 6891,
            "nrosocio": 25806,
            "apellido": "Recupito",
            "nombre": "Santiago",
            "dni": 55388215,
            "imagen": "https://adccanning.com.ar/img/foto/9213d8d8-34c5-4231-b211-c7c448ee9b7f.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180835,
            "sancionado": false
        },
        {
            "id": 5739,
            "nrosocio": 24743,
            "apellido": "Reus",
            "nombre": "Joaquin",
            "dni": 55073503,
            "imagen": "https://adccanning.com.ar/img/foto/47e1fca9-09e5-4bb5-8803-651b582ee16c.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180827,
            "sancionado": false
        },
        {
            "id": 12214,
            "nrosocio": 30923,
            "apellido": "Valdez",
            "nombre": "Benicio Dante",
            "dni": 54666817,
            "imagen": "https://adccanning.com.ar/img/foto/b0f0ef6c-0d70-4d46-8236-40f5c4aed514.webp",
            "estado": null,
            "face_api": null,
            "face_api_app": null,
            "jleid": 180829,
            "sancionado": false
        }
    ],
    "equipo_visitante": []
}

De ahi obtenemos, cual es el socio, el nombre, el apellido y su foto, pero si la foto viene con la variable  "face_api":null la foto es vieja, y no sirve para extraer los descriptores matematicos ni para hacer todo el proceso, asi que usaremos esas dos api nomas para el registro de los jugadores a traves de las fotos y para reordenarlos por equipo y categoria, tendras que hacer el proceso para cada id encontrado en partidos. 