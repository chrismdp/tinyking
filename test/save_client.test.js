import { MessageChannel } from "node:worker_threads";
import { createSaveClient, connectSaveWorker } from "game/autosave";
const originalChannel = global.MessageChannel;
const originalNavigator = Object.getOwnPropertyDescriptor(global, "navigator");
beforeEach(() => { global.MessageChannel = MessageChannel; });
afterEach(() => {
  global.MessageChannel = originalChannel;
  if (originalNavigator) Object.defineProperty(global, "navigator", originalNavigator);
  else delete global.navigator;
});
it("uses a reply port with a service worker that can outlive the page", async () => {
  const worker = { postMessage: jest.fn((message, ports) => {
    ports[0].postMessage({ result: message.operation === "inspect" });
    ports[0].close();
  }) };
  await expect(createSaveClient(worker)("inspect")).resolves.toBe(true);
  expect(worker.postMessage.mock.calls[0][0].operation).toBe("inspect");
  expect(worker.postMessage.mock.calls[0][1]).toHaveLength(1);
});
it("reports storage errors returned by the service worker", async () => {
  const worker = { postMessage(message, ports) {
    ports[0].postMessage({ error: "disk full" });
    ports[0].close();
  } };
  await expect(createSaveClient(worker)("save", {})).rejects.toThrow("disk full");
});
it("connects to an active worker before offering persistence", async () => {
  const registration = { active: { postMessage(message, ports) { ports[0].postMessage({ result: true }); ports[0].close(); } } };
  const register = jest.fn().mockResolvedValue(registration);
  Object.defineProperty(global, "navigator", { configurable: true, value: { serviceWorker: { register } } });
  const client = await connectSaveWorker();
  await expect(client("inspect")).resolves.toBe(true);
  expect(register).toHaveBeenCalledWith("/save-worker.js");
});
it("waits for an installing replacement before it sends a hex checkpoint",async()=>{
  let activate;
  const old={postMessage(){throw new Error("stale worker");}};
  const replacement={state:"installing",addEventListener:jest.fn((event,fn)=>{activate=fn;}),postMessage(message,ports){ports[0].postMessage({result:"new worker"});ports[0].close();}};
  const registration={active:old,installing:replacement,update:jest.fn(async()=>{})};
  Object.defineProperty(global,"navigator",{configurable:true,value:{serviceWorker:{register:async()=>registration}}});
  const connecting=connectSaveWorker();
  await new Promise(resolve=>setImmediate(resolve));
  expect(replacement.addEventListener).toHaveBeenCalled();
  replacement.state="activated";registration.active=replacement;activate();
  await expect((await connecting)("checkpoint",{})).resolves.toBe("new worker");
});
