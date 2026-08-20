const SUPABASE_URL = "https://orttrwtrsaltowrqckym.supabase.co";
const SUPABASE_KEY = "sb_publishable_ylnt_FLdN-83tMjcZDQuTA_jjAW55QT";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const estado = {
  auth: $("authSection"), cuenta: $("cuentaSection"), registro: $("registroBox"), login: $("loginBox"),
  authMsg: $("authMensaje"), datosMsg: $("datosMensaje"), prestamoMsg: $("prestamoMensaje"),
  limite: $("limiteCredito"), monto: $("montoSolicitado"), prestamo: $("miPrestamo"), pagos: $("misPagos")
};

const texto = (v) => String(v ?? "").trim();
const normal = (v) => texto(v).toLowerCase();
const dinero = (v) => Number(v ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fecha = (v) => v ? new Date(v).toLocaleDateString("es-MX") : "—";
const campo = (obj, nombres, defecto = null) => {
  for (const n of nombres) if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n];
  return defecto;
};

function mensaje(el, txt, error = false) {
  el.textContent = txt;
  el.style.color = error ? "#b91c1c" : "#166534";
}

function mostrarRegistro() {
  estado.registro.hidden = false;
  estado.login.hidden = true;
  estado.authMsg.textContent = "";
}

function mostrarLogin() {
  estado.registro.hidden = true;
  estado.login.hidden = false;
  estado.authMsg.textContent = "";
}

$("mostrarLogin").addEventListener("click", mostrarLogin);
$("mostrarRegistro").addEventListener("click", mostrarRegistro);

$("registroForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = texto($("registroEmail").value);
  const password = $("registroPassword").value;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    return mensaje(estado.authMsg, error.message, true);
  }

  if (data.session) {
    return abrirCuenta(data.user);
  }

  mensaje(
    estado.authMsg,
    "Cuenta creada. Revisa tu correo si Supabase solicita confirmación."
  );

  mostrarLogin();
  $("loginEmail").value = email;
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: texto($("loginEmail").value),
    password: $("loginPassword").value
  });

  if (error) {
    return mensaje(
      estado.authMsg,
      "No se pudo iniciar sesión: " + error.message,
      true
    );
  }

  await abrirCuenta(data.user);
});

$("cerrarSesionBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();

  estado.cuenta.hidden = true;
  estado.auth.hidden = false;

  mostrarLogin();
});

$("datosForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const datos = {
    nombre_completo: texto($("nombreCompleto").value),
    telefono: texto($("telefono").value),
    fecha_nacimiento: $("fechaNacimiento").value
  };

  if (
    !datos.nombre_completo ||
    !datos.telefono ||
    !datos.fecha_nacimiento
  ) {
    return mensaje(
      estado.datosMsg,
      "Completa todos tus datos.",
      true
    );
  }

  const { error } = await supabaseClient.auth.updateUser({
    data: datos
  });

  if (error) {
    return mensaje(
      estado.datosMsg,
      "No se pudieron guardar tus datos: " + error.message,
      true
    );
  }

  mensaje(
    estado.datosMsg,
    "Tus datos se guardaron correctamente."
  );
});

async function perfilCredito(userId) {
  const { data, error } = await supabaseClient
    .from("perfiles_crediticios")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Perfil crediticio:", error);
  }

  return data || null;
}

async function cargarPerfil(userId) {
  const perfil = await perfilCredito(userId);

  const limite = Number(
    perfil?.limite_credito ?? 500
  );

  estado.limite.textContent =
    ${dinero(limite)} MXN;

  estado.monto.value = limite;
  estado.monto.min = limite;
  estado.monto.max = limite;

  return perfil;
}

$("prestamoForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  estado.prestamoMsg.textContent = "";

  const {
    data: u,
    error: userError
  } = await supabaseClient.auth.getUser();

  if (userError || !u.user) {
    return mensaje(
      estado.prestamoMsg,
      "Tu sesión expiró.",
      true
    );
  }

  const user = u.user;
  const meta = user.user_metadata || {};

  const nombre = texto(
    meta.nombre_completo ||
    $("nombreCompleto").value
  );

  const telefono = texto(
    meta.telefono ||
    $("telefono").value
  );

  const nacimiento =
    meta.fecha_nacimiento ||
    $("fechaNacimiento").value;

  if (!nombre || !telefono || !nacimiento) {
    return mensaje(
      estado.prestamoMsg,
      "Primero guarda tu nombre, teléfono y fecha de nacimiento.",
      true
    );
  }

  const {
    data: solicitudes,
    error: revError
  } = await supabaseClient
    .from("solicitudes")
    .select("id, estatus_solicitud")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(20);

  if (revError) {
    return mensaje(
      estado.prestamoMsg,
      "No se pudo revisar tu solicitud: " +
      revError.message,
      true
    );
  }

  const enProceso =
    (solicitudes || []).some((s) =>
      [
        "pendiente",
        "en_revision",
        "en revisión",
        "aprobada",
        "aprobado"
      ].includes(normal(s.estatus_solicitud))
    );

  if (enProceso) {
    return mensaje(
      estado.prestamoMsg,
      "Ya tienes una solicitud en proceso.",
      true
    );
  }

  const perfil =
    await perfilCredito(user.id);

  const limite = Number(
    perfil?.limite_credito ?? 500
  );

  const monto =
    Number(estado.monto.value);

  if (
    !Number.isFinite(monto) ||
    monto <= 0 ||
    monto > limite
  ) {
    return mensaje(
      estado.prestamoMsg,
      El monto debe respetar tu límite de ${dinero(limite)}.,
      true
    );
  }

  const solicitud = {
    user_id: user.id,
    nombre_completo: nombre,
    telefono,
    email: user.email,
    fecha_nacimiento: nacimiento,
    monto_solicitado: monto,
    estatus_solicitud: "pendiente",
    fecha_solicitud: new Date().toISOString(),

    limite_credito: limite,

    prestamos_pagados:
      Number(perfil?.prestamos_pagados ?? 0),

    pagos_atrasados:
      Number(perfil?.pagos_atrasados ?? 0),

    prestamos_morosos:
      Number(perfil?.prestamos_morosos ?? 0),

    dias_mora_acumulados:
      Number(perfil?.dias_mora_acumulados ?? 0),

    fecha_primer_prestamo:
      perfil?.fecha_primer_prestamo ?? null,

    nivel_crediticio:
      Number(perfil?.nivel_crediticio ?? 1)
  };

  const { error } =
    await supabaseClient
      .from("solicitudes")
      .insert(solicitud);

  if (error) {
    return mensaje(
      estado.prestamoMsg,
      "No se pudo enviar la solicitud: " +
      error.message,
      true
    );
  }

  mensaje(
    estado.prestamoMsg,
    Solicitud por ${dinero(monto)} enviada correctamente.
  );
});

async function cargarPrestamo(userId) {
  const { data, error } =
    await supabaseClient
      .from("prestamos")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(20);

  if (error) {
    console.error(
      "Préstamos:",
      error
    );

    estado.prestamo.textContent =
      "No se pudo cargar la información del préstamo.";

    return cargarPagos(
      userId,
      null
    );
  }

  const activo =
    (data || []).find((p) => {
      const estatus =
        normal(
          campo(
            p,
            [
              "estatus",
              "estado",
              "estatus_prestamo"
            ],
            ""
          )
        );

      const saldo =
        Number(
          campo(
            p,
            [
              "saldo_pendiente",
              "saldo",
              "monto_pendiente"
            ],
            0
          )
        );

      return (
        [
          "activo",
          "vigente",
          "active"
        ].includes(estatus) ||
        saldo > 0
      );
    });

  if (!activo) {
    estado.prestamo.textContent =
      "Todavía no tienes un préstamo activo.";

    return cargarPagos(
      userId,
      null
    );
  }

  const monto =
    campo(
      activo,
      [
        "monto",
        "monto_prestado",
        "monto_aprobado",
        "monto_solicitado"
      ],
      0
    );

  const saldo =
    campo(
      activo,
      [
        "saldo_pendiente",
        "saldo",
        "monto_pendiente"
      ],
      monto
    );

  const estatus =
    campo(
      activo,
      [
        "estatus",
        "estado",
        "estatus_prestamo"
      ],
      "Activo"
    );

  const inicio =
    campo(
      activo,
      [
        "fecha_inicio",
        "fecha_prestamo",
        "created_at",
        "fecha_creacion"
      ],
      null
    );

  estado.prestamo.innerHTML = `
    <p>
      <strong>Monto:</strong>
      ${dinero(monto)}
    </p>

    <p>
      <strong>Saldo pendiente:</strong>
      ${dinero(saldo)}
    </p>

    <p>
      <strong>Estatus:</strong>
      ${estatus}
    </p>

    <p>
      <strong>Fecha:</strong>
      ${fecha(inicio)}
    </p>
  `;

  await cargarPagos(
    userId,
    activo.id
  );
}

async function cargarPagos(
  userId,
  prestamoId
) {
  let r =
    prestamoId == null
      ? null
      : await supabaseClient
          .from("pagos")
          .select("*")
          .eq(
            "prestamo_id",
            prestamoId
          )
          .order(
            "id",
            { ascending: false }
          );

  if (!r || r.error) {
    r =
      await supabaseClient
        .from("pagos")
        .select("*")
        .eq(
          "user_id",
          userId
        )
        .order(
          "id",
          { ascending: false }
        );
  }

  if (
    r.error ||
    !r.data?.length
  ) {
    if (r.error) {
      console.error(
        "Pagos:",
        r.error
      );
    }

    estado.pagos.textContent =
      "Todavía no hay pagos registrados.";

    return;
  }

  estado.pagos.innerHTML =
    r.data.map((p) => {
      const monto =
        campo(
          p,
          [
            "monto",
            "monto_pago",
            "cantidad"
          ],
          0
        );

      const cuando =
        campo(
          p,
          [
            "fecha_pago",
            "created_at",
            "fecha"
          ],
          null
        );

      const estatus =
        campo(
          p,
          [
            "estatus",
            "estado"
          ],
          "Registrado"
        );

      return `
        <div>
          <strong>
            ${dinero(monto)}
          </strong>
          —
          ${fecha(cuando)}
          —
          ${estatus}
        </div>
      `;
    }).join("");
}

async function abrirCuenta(user) {
  if (!user) {
    return;
  }

  estado.auth.hidden = true;
  estado.cuenta.hidden = false;

  const meta =
    user.user_metadata || {};

  $("nombreCompleto").value =
    meta.nombre_completo || "";

  $("telefono").value =
    meta.telefono || "";

  $("fechaNacimiento").value =
    meta.fecha_nacimiento || "";

  await cargarPerfil(
    user.id
  );

  await cargarPrestamo(
    user.id
  );
}

supabaseClient.auth.onAuthStateChange(
  (evento, sesion) => {
    setTimeout(() => {
      if (
        evento === "SIGNED_OUT" ||
        !sesion?.user
      ) {
        estado.cuenta.hidden = true;
        estado.auth.hidden = false;
      }
    }, 0);
  }
);

(async () => {
  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error(
      "Sesión:",
      error
    );
  }

  if (data?.session?.user) {
    await abrirCuenta(
      data.session.user
    );
  } else {
    estado.auth.hidden = false;
    estado.cuenta.hidden = true;
    mostrarRegistro();
  }
})();
