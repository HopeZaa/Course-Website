const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "database.json");
const TOKEN_SECRET = "hopezaa-academy-local-secret";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const writeDb = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n");
const hashPassword = (password) => crypto.createHash("sha256").update(password).digest("hex");
const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const send = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
};

const sendError = (res, status, message) => send(res, status, { error: message });

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

const sign = (value) => crypto.createHmac("sha256", TOKEN_SECRET).update(value).digest("hex");

const createToken = (userId) => {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(payload) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  cart: user.cart || [],
  purchases: user.purchases || []
});

const authUser = (req, db) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = verifyToken(token);
  if (!userId) return null;
  return db.users.find((user) => user.id === userId) || null;
};

const courseMap = (db) => new Map(db.courses.map((course) => [course.id, course]));

const publicState = (db) => ({
  courses: db.courses,
  reviews: db.reviews.slice().reverse()
});

const requireFields = (body, fields) => fields.every((field) => typeof body[field] === "string" && body[field].trim());

const api = async (req, res, pathname) => {
  const db = readDb();

  if (req.method === "GET" && pathname === "/api/public") {
    return send(res, 200, publicState(db));
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await parseBody(req);
    if (!requireFields(body, ["name", "username", "password"])) {
      return sendError(res, 400, "กรอกข้อมูลสมัครสมาชิกให้ครบ");
    }

    const username = body.username.trim();
    if (db.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      return sendError(res, 409, "username นี้ถูกใช้งานแล้ว");
    }

    const user = {
      id: id("user"),
      name: body.name.trim(),
      username,
      passwordHash: hashPassword(body.password),
      role: "student",
      cart: [],
      purchases: [],
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDb(db);
    return send(res, 201, { token: createToken(user.id), user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await parseBody(req);
    if (!requireFields(body, ["username", "password"])) {
      return sendError(res, 400, "กรอก username และ password");
    }

    const user = db.users.find((item) => item.username.toLowerCase() === body.username.trim().toLowerCase());
    if (!user || user.passwordHash !== hashPassword(body.password)) {
      return sendError(res, 401, "username หรือ password ไม่ถูกต้อง");
    }

    return send(res, 200, { token: createToken(user.id), user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/contact") {
    const body = await parseBody(req);
    if (!requireFields(body, ["name", "phone", "email", "subject", "message"])) {
      return sendError(res, 400, "กรอกข้อมูลติดต่อให้ครบ");
    }
    db.contacts.push({
      id: id("contact"),
      name: body.name.trim(),
      phone: body.phone.trim(),
      email: body.email.trim(),
      subject: body.subject.trim(),
      message: body.message.trim(),
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    return send(res, 201, { ok: true });
  }

  const user = authUser(req, db);
  if (!user) return sendError(res, 401, "กรุณาเข้าสู่ระบบก่อน");

  if (req.method === "GET" && pathname === "/api/me") {
    return send(res, 200, { user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/cart/add") {
    const body = await parseBody(req);
    const courses = courseMap(db);
    const course = courses.get(body.courseId);
    if (!course) return sendError(res, 404, "ไม่พบคอร์สนี้");
    if ((user.purchases || []).includes(course.id)) return sendError(res, 409, "คุณซื้อคอร์สนี้แล้ว");
    if (course.enrolled >= course.capacity) return sendError(res, 409, "คอร์สนี้เต็มแล้ว");
    user.cart = user.cart || [];
    if (!user.cart.includes(course.id)) user.cart.push(course.id);
    writeDb(db);
    return send(res, 200, { user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/cart/remove") {
    const body = await parseBody(req);
    user.cart = (user.cart || []).filter((courseId) => courseId !== body.courseId);
    writeDb(db);
    return send(res, 200, { user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/checkout") {
    const body = await parseBody(req);
    const requestedIds = Array.isArray(body.courseIds) && body.courseIds.length ? body.courseIds : user.cart || [];
    const uniqueIds = [...new Set(requestedIds)];
    if (!uniqueIds.length) return sendError(res, 400, "ไม่มีคอร์สสำหรับชำระเงิน");

    const courses = courseMap(db);
    const selectedCourses = uniqueIds.map((courseId) => courses.get(courseId)).filter(Boolean);
    if (selectedCourses.length !== uniqueIds.length) return sendError(res, 404, "พบคอร์สบางรายการที่ไม่มีอยู่");

    const purchased = new Set(user.purchases || []);
    const buyableCourses = selectedCourses.filter((course) => !purchased.has(course.id));
    if (!buyableCourses.length) return sendError(res, 409, "คุณซื้อคอร์สเหล่านี้แล้ว");
    const fullCourse = buyableCourses.find((course) => course.enrolled >= course.capacity);
    if (fullCourse) return sendError(res, 409, `${fullCourse.title} เต็มแล้ว`);

    const order = {
      id: id("order"),
      userId: user.id,
      username: user.username,
      courseIds: buyableCourses.map((course) => course.id),
      total: buyableCourses.reduce((sum, course) => sum + course.price, 0),
      status: "paid",
      paidAt: new Date().toISOString()
    };

    buyableCourses.forEach((course) => {
      course.enrolled += 1;
    });
    user.purchases = [...new Set([...(user.purchases || []), ...order.courseIds])];
    user.cart = (user.cart || []).filter((courseId) => !order.courseIds.includes(courseId));
    db.orders.push(order);
    writeDb(db);

    return send(res, 200, { order, user: publicUser(user), ...publicState(db) });
  }

  if (!pathname.startsWith("/api/admin/")) {
    return sendError(res, 404, "ไม่พบ API");
  }

  if (user.role !== "admin") return sendError(res, 403, "สิทธิ์เฉพาะแอดมิน");

  const courseAdjustMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/adjust$/);
  if (req.method === "POST" && courseAdjustMatch) {
    const body = await parseBody(req);
    const course = db.courses.find((item) => item.id === courseAdjustMatch[1]);
    if (!course) return sendError(res, 404, "ไม่พบคอร์สนี้");
    const field = body.field === "capacity" ? "capacity" : "enrolled";
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || Math.abs(delta) !== 1) return sendError(res, 400, "delta ต้องเป็น 1 หรือ -1");

    const next = course[field] + delta;
    if (field === "enrolled") course.enrolled = Math.max(0, Math.min(next, course.capacity));
    if (field === "capacity") course.capacity = Math.max(course.enrolled, next);

    writeDb(db);
    return send(res, 200, { user: publicUser(user), ...publicState(db) });
  }

  if (req.method === "POST" && pathname === "/api/admin/reviews") {
    const body = await parseBody(req);
    if (!requireFields(body, ["name", "courseId", "message"])) {
      return sendError(res, 400, "กรอกรีวิวให้ครบ");
    }
    const course = db.courses.find((item) => item.id === body.courseId);
    if (!course) return sendError(res, 404, "ไม่พบคอร์สนี้");

    db.reviews.push({
      id: id("review"),
      name: body.name.trim(),
      courseId: course.id,
      courseTitle: course.title,
      message: body.message.trim(),
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    return send(res, 201, { user: publicUser(user), ...publicState(db) });
  }

  return sendError(res, 404, "ไม่พบ API");
};

const serveStatic = (req, res, pathname) => {
  const safePath = path.normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  const publicFiles = new Set(["/index.html", "/styles.css", "/script.js"]);
  const normalizedPublicPath = safePath.startsWith("/") ? safePath : `/${safePath}`;
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!publicFiles.has(normalizedPublicPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname.startsWith("/api/")) {
      return await api(req, res, pathname);
    }
    return serveStatic(req, res, pathname);
  } catch (error) {
    return sendError(res, error.message === "Invalid JSON" ? 400 : 500, error.message || "เกิดข้อผิดพลาด");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`HopeZaa Academy running at http://${HOST}:${PORT}`);
});