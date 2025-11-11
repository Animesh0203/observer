export namespace main {
	
	export class FolderData {
	    id: number;
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new FolderData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class ImageData {
	    id: string;
	    name: string;
	    path: string;
	    thumbnailPath: string;
	    folderId: string;
	    folder: string;
	    size: number;
	    // Go type: time
	    created: any;
	    // Go type: time
	    modified: any;
	    width: number;
	    height: number;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ImageData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.thumbnailPath = source["thumbnailPath"];
	        this.folderId = source["folderId"];
	        this.folder = source["folder"];
	        this.size = source["size"];
	        this.created = this.convertValues(source["created"], null);
	        this.modified = this.convertValues(source["modified"], null);
	        this.width = source["width"];
	        this.height = source["height"];
	        this.tags = source["tags"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

