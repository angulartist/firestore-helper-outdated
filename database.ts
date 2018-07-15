import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map, take, tap } from "rxjs/operators";
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument
} from "angularfire2/firestore";
import * as firebase from "firebase/app";

type CollectionPredicate<T> = string | AngularFirestoreCollection<T>;
type DocPredicate<T> = string | AngularFirestoreDocument<T>;

@Injectable({
  providedIn: "root"
})
export class FirestoreService {
  constructor(public afs: AngularFirestore) {}

  /**
   * Ref
   */

  col<T>(ref: CollectionPredicate<T>, queryFn?): AngularFirestoreCollection<T> {
    return typeof ref === "string" ? this.afs.collection<T>(ref, queryFn) : ref;
  }

  doc<T>(ref: DocPredicate<T>): AngularFirestoreDocument<T> {
    return typeof ref === "string" ? this.afs.doc<T>(ref) : ref;
  }

  /**
   * Query
   */

  doc$<T>(ref: DocPredicate<T>): Observable<T> {
    return this.doc(ref)
      .snapshotChanges()
      .pipe(
        map(doc => {
          return doc.payload.data() as T;
        })
      );
  }

  col$<T>(ref: CollectionPredicate<T>, queryFn?): Observable<T[]> {
    return this.col(ref, queryFn)
      .snapshotChanges()
      .pipe(
        map(docs => {
          return docs.map(a => a.payload.doc.data()) as T[];
        })
      );
  }
  
  /**
   * Query with ID
   */

  getItems$<T>(ref: CollectionPredicate<T>, queryFn?): Observable<T[]> {
    return this.col(ref, queryFn)
      .snapshotChanges()
      .pipe(
        map(actions => {
          return actions.map(a => {
            const data = a.payload.doc.data() as any;
            const uid = a.payload.doc.id;
            return { uid, ...data };
          });
        })
      );
  }

  getItem$<T>(
    ref: CollectionPredicate<T>,
    uid: string,
    queryFn?
  ): Observable<T> {
    return this.col(ref, queryFn)
      .doc(`/${uid}`)
      .snapshotChanges()
      .pipe(
        map(actions => {
          const data = actions.payload.data() as any;
          const uid = actions.payload.id;
          return { uid, ...data};
        })
      );
  }

  /**
   * CRUD Ops w/ timestamp management
   */

  get timestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  set<T>(ref: DocPredicate<T>, data: any) {
    const timestamp = this.timestamp;
    return this.doc(ref).set({
      ...data,
      updatedAt: timestamp,
      createdAt: timestamp
    });
  }

  update<T>(ref: DocPredicate<T>, data: any) {
    return this.doc(ref).update({
      ...data,
      updatedAt: this.timestamp
    });
  }

  delete<T>(ref: DocPredicate<T>) {
    return this.doc(ref).delete();
  }

  add<T>(ref: CollectionPredicate<T>, data) {
    const timestamp = this.timestamp;
    return this.col(ref).add({
      ...data,
      updatedAt: timestamp,
      createdAt: timestamp
    });
  }

  upsert<T>(ref: DocPredicate<T>, data: any) {
    const doc = this.doc(ref)
      .snapshotChanges()
      .pipe(take(1))
      .toPromise();

    return doc.then(snap => {
      return snap.payload.exists ? this.update(ref, data) : this.set(ref, data);
    });
  }

  /**
   * Inspect
   */

  inspectDoc(ref: DocPredicate<any>): void {
    const tick = new Date().getTime();
    this.doc(ref)
      .snapshotChanges()
      .pipe(
        take(1),
        tap(d => {
          const tock = new Date().getTime() - tick;
          console.log(`Loaded Document in ${tock}ms`, d);
        })
      )
      .subscribe();
  }

  inspectCol(ref: CollectionPredicate<any>): void {
    const tick = new Date().getTime();
    this.col(ref)
      .snapshotChanges()
      .pipe(
        take(1),
        tap(c => {
          const tock = new Date().getTime() - tick;
          console.log(`Loaded Collection in ${tock}ms`, c);
        })
      )
      .subscribe();
  }

  /**
   * Hosting
   */

  connect(host: DocPredicate<any>, key: string, doc: DocPredicate<any>) {
    return this.doc(host).update({ [key]: this.doc(doc).ref });
  }

  docWithRefs$<T>(ref: DocPredicate<T>) {
    return this.doc$(ref).pipe(
      map(doc => {
        for (const k of Object.keys(doc)) {
          if (doc[k] instanceof firebase.firestore.DocumentReference) {
            doc[k] = this.doc(doc[k].path);
          }
        }
        return doc;
      })
    );
  }

  /**
   * Batch
   */

  atomic() {
    /**
     * Init Batch
     */

    const batch = firebase.firestore().batch();

    /* your ops */

    /**
     * Run Batch
     */
    return batch.commit();
  }
}
