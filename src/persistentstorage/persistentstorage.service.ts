import { Injectable, Logger } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class PersistentStorageService {
  private readonly logger = new Logger(PersistentStorageService.name);

  public async upload(file): Promise<any> {
    const filename = file.originalname;
    const bucketS3 = 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923';
    return this.uploadS3(file.buffer, bucketS3, filename);
  }

  private async uploadS3(file, bucket, name): Promise<any> {
    const s3 = PersistentStorageService.getS3();
    const params = {
      Bucket: bucket,
      Key: String(name),
      Body: file,
    };
    const data = await s3
      .upload(params)
      .promise()
      .then((res) => {
        return res;
      })
      .catch((e) => {
        this.logger.debug(e.toString());
        return null;
      });
    return data;
  }

  public async uploadImage(file): Promise<string> {
    const filename = `public/${file.originalname}`;
    const bucketS3 = 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923';
    const data = await this.uploadS3(file.buffer, bucketS3, filename);
    const url = `https://bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923.s3.amazonaws.com/${data.key}`;
    // const s3 = PersistentStorageService.getS3();
    // const url = await s3.getSignedUrlPromise('putObject',{
    //   Bucket: 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923',
    //   Key: `public/${data.Key}`,
    //   ACL: 'public-read',
    //   ContentType: file.mimetype,
    // });
    return url;
  }

  public async getFile(key: string): Promise<any> {
    const s3 = PersistentStorageService.getS3();
    const params = {
      Bucket: 'bucketeer-97d78e08-2ff3-4666-a58b-8bb699a71923',
      Key: String(key),
    };
    const file = await s3.getObject(params).promise();
    return file;
  }

  private static getS3() {
    return new S3({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    });
  }
}
